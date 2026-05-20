import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pandas as pd
from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.schemas.dataset import (
    CleaningSuggestion,
    DatasetAnalysisResponse,
    DatasetChartResponse,
    DatasetCleaningAnalysisResponse,
    DatasetColumnPreview,
    DatasetCategoricalSummary,
    DatasetMetadataResponse,
    DatasetNpsBreakdown,
    DatasetNumericSummary,
    DatasetPreviewResponse,
    DatasetUploadResponse,
)

ALLOWED_EXTENSIONS = {
    ".csv": "csv",
    ".xlsx": "excel",
    ".xls": "excel",
    ".sav": "spss",
}


def validate_dataset_file(file: UploadFile) -> tuple[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload CSV, Excel, or SPSS files.",
        )

    return suffix, ALLOWED_EXTENSIONS[suffix]


def read_dataset(path: Path, suffix: str, sample_limit: int | None = None) -> pd.DataFrame:
    try:
        if suffix == ".csv":
            return pd.read_csv(path, nrows=sample_limit)
        elif suffix in {".xlsx", ".xls"}:
            return pd.read_excel(path, nrows=sample_limit)
        elif suffix == ".sav":
            frame = pd.read_spss(path)
            return frame.head(sample_limit) if sample_limit else frame
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File could not be parsed as a dataset: {exc}",
        ) from exc

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported dataset file extension.",
    )


def parse_dataset(path: Path, suffix: str) -> tuple[int | None, int | None]:
    frame = read_dataset(path, suffix)
    return int(frame.shape[0]), int(frame.shape[1])


def metadata_path() -> Path:
    return Path(settings.metadata_dir) / "datasets.jsonl"


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while chunk := file.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def load_dataset_metadata(dataset_id: str, owner_id: str | None) -> dict[str, object]:
    path = metadata_path()
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")

    with path.open("r", encoding="utf-8") as metadata_file:
        for line in metadata_file:
            if not line.strip():
                continue
            metadata = json.loads(line)
            if metadata.get("id") == dataset_id:
                if owner_id and metadata.get("owner_id") not in {owner_id, None, ""}:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")
                return metadata

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found.")


def frame_to_preview_rows(frame: pd.DataFrame, limit: int = 10) -> list[dict[str, object]]:
    preview = frame.head(limit).where(pd.notnull(frame), None)
    rows: list[dict[str, object]] = []
    for row in preview.to_dict(orient="records"):
        rows.append({str(key): normalize_preview_value(value) for key, value in row.items()})
    return rows


def normalize_preview_value(value: object) -> object:
    if value is None:
        return None
    if hasattr(value, "item"):
        return value.item()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def build_schema_preview(frame: pd.DataFrame) -> list[DatasetColumnPreview]:
    total_rows = len(frame.index)
    columns: list[DatasetColumnPreview] = []

    for column_name in frame.columns:
        null_count = int(frame[column_name].isna().sum())
        null_percentage = round((null_count / total_rows) * 100, 2) if total_rows else 0.0
        columns.append(
            DatasetColumnPreview(
                name=str(column_name),
                data_type=str(frame[column_name].dtype),
                null_percentage=null_percentage,
            )
        )

    return columns


def get_dataset_preview(dataset_id: str, owner_id: str | None) -> DatasetPreviewResponse:
    metadata = load_dataset_metadata(dataset_id, owner_id)
    stored_filename = str(metadata["stored_filename"])
    file_path = Path(settings.upload_dir) / stored_filename

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored dataset file not found.")

    suffix = file_path.suffix.lower()
    frame = read_dataset(file_path, suffix)
    current_sha256 = compute_sha256(file_path)
    stored_sha256 = str(metadata["sha256"])

    return DatasetPreviewResponse(
        id=dataset_id,
        file_name=str(metadata["file_name"]),
        file_type=str(metadata["file_type"]),
        file_size=int(metadata["file_size"]),
        sha256=current_sha256,
        integrity_verified=current_sha256 == stored_sha256,
        uploaded_at=str(metadata["uploaded_at"]),
        row_count=int(frame.shape[0]),
        column_count=int(frame.shape[1]),
        columns=build_schema_preview(frame),
        sample_rows=frame_to_preview_rows(frame),
    )


def get_dataset_metadata(dataset_id: str, owner_id: str | None) -> DatasetMetadataResponse:
    metadata = load_dataset_metadata(dataset_id, owner_id)

    return DatasetMetadataResponse(
        id=str(metadata["id"]),
        file_name=str(metadata["file_name"]),
        file_type=str(metadata["file_type"]),
        file_size=int(metadata["file_size"]),
        sha256=str(metadata["sha256"]),
        uploaded_at=str(metadata["uploaded_at"]),
        rows=int(metadata["rows"]) if metadata.get("rows") is not None else None,
        columns=int(metadata["columns"]) if metadata.get("columns") is not None else None,
        status="success",
        message="Dataset metadata loaded successfully.",
    )


def get_dataset_frame(dataset_id: str, owner_id: str | None) -> tuple[dict[str, object], pd.DataFrame]:
    metadata = load_dataset_metadata(dataset_id, owner_id)
    stored_filename = str(metadata["stored_filename"])
    file_path = Path(settings.upload_dir) / stored_filename

    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored dataset file not found.")

    return metadata, read_dataset(file_path, file_path.suffix.lower())


def find_duplicate_suggestion(frame: pd.DataFrame) -> CleaningSuggestion | None:
    duplicate_count = int(frame.duplicated().sum())
    if duplicate_count == 0:
        return None

    return CleaningSuggestion(
        id="remove-duplicate-rows",
        type="duplicates",
        title="Remove duplicate rows",
        description=f"{duplicate_count} duplicate row(s) were detected across all columns.",
        affected_columns=[str(column) for column in frame.columns],
        affected_rows=duplicate_count,
        strategy="drop_duplicates",
        confidence=0.95,
    )


def find_missing_value_suggestions(frame: pd.DataFrame) -> list[CleaningSuggestion]:
    suggestions: list[CleaningSuggestion] = []
    numeric_columns = [
        str(column)
        for column in frame.select_dtypes(include=["number"]).columns
        if int(frame[column].isna().sum()) > 0
    ]

    if numeric_columns:
        affected_rows = int(frame[numeric_columns].isna().any(axis=1).sum())
        suggestions.append(
            CleaningSuggestion(
                id="fill-numeric-missing-mean",
                type="missing_values",
                title="Fill missing numeric values with mean",
                description="Numeric columns contain missing values that can be filled with each column mean.",
                affected_columns=numeric_columns,
                affected_rows=affected_rows,
                strategy="fill_mean",
                confidence=0.72,
            )
        )
        suggestions.append(
            CleaningSuggestion(
                id="fill-numeric-missing-median",
                type="missing_values",
                title="Fill missing numeric values with median",
                description="Median filling is more robust when numeric columns contain outliers.",
                affected_columns=numeric_columns,
                affected_rows=affected_rows,
                strategy="fill_median",
                confidence=0.78,
            )
        )

    text_columns = [
        str(column)
        for column in frame.select_dtypes(include=["object", "string", "category"]).columns
        if int(frame[column].isna().sum()) > 0
    ]
    if text_columns:
        suggestions.append(
            CleaningSuggestion(
                id="fill-text-missing-mode",
                type="missing_values",
                title="Fill missing text values with most common value",
                description="Text columns contain blanks that can be filled with the most frequent non-empty value.",
                affected_columns=text_columns,
                affected_rows=int(frame[text_columns].isna().any(axis=1).sum()),
                strategy="fill_mode",
                confidence=0.66,
            )
        )

    return suggestions


def find_text_casing_suggestion(frame: pd.DataFrame) -> CleaningSuggestion | None:
    affected_columns: list[str] = []
    affected_rows = 0

    for column in frame.select_dtypes(include=["object", "string", "category"]).columns:
        series = frame[column].dropna().astype(str).str.strip()
        if series.empty:
            continue

        normalized = series.str.lower()
        variant_groups = series.groupby(normalized).nunique()
        inconsistent_groups = variant_groups[variant_groups > 1]
        if not inconsistent_groups.empty:
            affected_columns.append(str(column))
            affected_rows += int(series[normalized.isin(inconsistent_groups.index)].shape[0])

    if not affected_columns:
        return None

    return CleaningSuggestion(
        id="standardize-text-casing",
        type="text_casing",
        title="Correct inconsistent text casing",
        description="Some text values appear in multiple casing styles and can be standardized.",
        affected_columns=affected_columns,
        affected_rows=affected_rows,
        strategy="standardize_title_case",
        confidence=0.7,
    )


def save_cleaning_analysis(response: DatasetCleaningAnalysisResponse, owner_id: str | None) -> None:
    Path(settings.metadata_dir).mkdir(parents=True, exist_ok=True)
    analysis = response.model_dump()
    analysis["owner_id"] = owner_id

    with (Path(settings.metadata_dir) / "cleaning_suggestions.jsonl").open(
        "a",
        encoding="utf-8",
    ) as analysis_file:
        analysis_file.write(json.dumps(analysis) + "\n")


def analyse_dataset_cleaning(dataset_id: str, owner_id: str | None) -> DatasetCleaningAnalysisResponse:
    _, frame = get_dataset_frame(dataset_id, owner_id)
    suggestions: list[CleaningSuggestion] = []

    duplicate_suggestion = find_duplicate_suggestion(frame)
    if duplicate_suggestion:
        suggestions.append(duplicate_suggestion)

    suggestions.extend(find_missing_value_suggestions(frame))

    casing_suggestion = find_text_casing_suggestion(frame)
    if casing_suggestion:
        suggestions.append(casing_suggestion)

    response = DatasetCleaningAnalysisResponse(
        dataset_id=dataset_id,
        analysed_at=datetime.now(UTC).isoformat(),
        row_count=int(frame.shape[0]),
        column_count=int(frame.shape[1]),
        suggestions=suggestions,
        status="success",
        message=(
            f"{len(suggestions)} cleaning suggestion(s) found."
            if suggestions
            else "No basic cleaning suggestions were found."
        ),
    )
    save_cleaning_analysis(response, owner_id)
    return response


def detect_nps_column(frame: pd.DataFrame) -> str | None:
    candidates = [
        str(column)
        for column in frame.columns
        if any(keyword in str(column).lower() for keyword in ["nps", "recommend", "likelihood"])
    ]
    numeric_columns = [str(column) for column in frame.select_dtypes(include=["number"]).columns]

    for column in candidates + numeric_columns:
        scores = pd.to_numeric(frame[column], errors="coerce").dropna()
        if scores.empty:
            continue
        if scores.between(0, 10).mean() >= 0.9:
            return column

    return None


def build_nps_breakdown(frame: pd.DataFrame) -> DatasetNpsBreakdown | None:
    column = detect_nps_column(frame)
    if not column:
        return None

    scores = pd.to_numeric(frame[column], errors="coerce").dropna()
    if scores.empty:
        return None

    total = int(scores.shape[0])
    promoters = int((scores >= 9).sum())
    passives = int(((scores >= 7) & (scores <= 8)).sum())
    detractors = int((scores < 7).sum())

    promoter_percentage = round((promoters / total) * 100, 1)
    passive_percentage = round((passives / total) * 100, 1)
    detractor_percentage = round((detractors / total) * 100, 1)

    return DatasetNpsBreakdown(
        column=column,
        total_responses=total,
        promoters=promoters,
        passives=passives,
        detractors=detractors,
        promoter_percentage=promoter_percentage,
        passive_percentage=passive_percentage,
        detractor_percentage=detractor_percentage,
        score=round(promoter_percentage - detractor_percentage, 1),
    )


def normalize_float(value: object) -> float | None:
    if pd.isna(value):
        return None
    return round(float(value), 3)


def analyse_dataset(dataset_id: str, owner_id: str | None) -> DatasetAnalysisResponse:
    _, frame = get_dataset_frame(dataset_id, owner_id)
    total_cells = int(frame.shape[0] * frame.shape[1])
    missing_cells = int(frame.isna().sum().sum())
    numeric_frame = frame.select_dtypes(include=["number"])
    categorical_frame = frame.select_dtypes(include=["object", "string", "category", "bool"])

    numeric_summary: list[DatasetNumericSummary] = []
    for column in numeric_frame.columns[:8]:
        series = pd.to_numeric(numeric_frame[column], errors="coerce")
        numeric_summary.append(
            DatasetNumericSummary(
                column=str(column),
                count=int(series.count()),
                mean=normalize_float(series.mean()),
                median=normalize_float(series.median()),
                minimum=normalize_float(series.min()),
                maximum=normalize_float(series.max()),
                missing=int(series.isna().sum()),
            )
        )

    categorical_summary: list[DatasetCategoricalSummary] = []
    for column in categorical_frame.columns[:8]:
        series = categorical_frame[column]
        counts = series.dropna().astype(str).value_counts()
        categorical_summary.append(
            DatasetCategoricalSummary(
                column=str(column),
                unique_values=int(series.nunique(dropna=True)),
                top_value=str(counts.index[0]) if not counts.empty else None,
                top_count=int(counts.iloc[0]) if not counts.empty else 0,
                missing=int(series.isna().sum()),
            )
        )

    nps = build_nps_breakdown(frame)
    return DatasetAnalysisResponse(
        dataset_id=dataset_id,
        analysed_at=datetime.now(UTC).isoformat(),
        row_count=int(frame.shape[0]),
        column_count=int(frame.shape[1]),
        duplicate_rows=int(frame.duplicated().sum()),
        missing_cells=missing_cells,
        missing_cell_percentage=round((missing_cells / total_cells) * 100, 2) if total_cells else 0.0,
        numeric_columns=int(len(numeric_frame.columns)),
        categorical_columns=int(len(categorical_frame.columns)),
        nps=nps,
        numeric_summary=numeric_summary,
        categorical_summary=categorical_summary,
        status="success",
        message="Dataset analysis completed successfully.",
    )


def series_to_chart_values(series: pd.Series, limit: int = 50) -> list[object]:
    values: list[object] = []
    for value in series.head(limit).where(pd.notnull(series), None).tolist():
        values.append(normalize_preview_value(value))
    return values


def get_dataset_chart(dataset_id: str, owner_id: str | None) -> DatasetChartResponse:
    _, frame = get_dataset_frame(dataset_id, owner_id)
    if frame.empty or len(frame.columns) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dataset has no plottable data.")

    numeric_columns = [str(column) for column in frame.select_dtypes(include=["number"]).columns]
    chart_type = "bar"
    title = "Dataset sample chart"
    x_label = "Row"
    y_label = "Value"
    x_values: list[object]
    y_values: list[object]

    if len(numeric_columns) >= 2:
        chart_type = "scatter"
        x_label = numeric_columns[0]
        y_label = numeric_columns[1]
        title = f"{y_label} by {x_label}"
        x_values = series_to_chart_values(frame[x_label], limit=100)
        y_values = series_to_chart_values(frame[y_label], limit=100)
    elif len(numeric_columns) == 1:
        y_label = numeric_columns[0]
        title = f"{y_label} sample values"
        sample = frame[y_label].head(50)
        x_values = [int(index) + 1 for index in range(len(sample))]
        y_values = series_to_chart_values(sample, limit=50)
    else:
        categorical_column = str(frame.columns[0])
        counts = frame[categorical_column].dropna().astype(str).value_counts().head(12)
        x_label = categorical_column
        y_label = "Count"
        title = f"{categorical_column} distribution"
        x_values = [str(value) for value in counts.index.tolist()]
        y_values = [int(value) for value in counts.tolist()]

    return DatasetChartResponse(
        dataset_id=dataset_id,
        chart_type=chart_type,
        title=title,
        x_label=x_label,
        y_label=y_label,
        x=x_values,
        y=y_values,
        table_columns=[str(column) for column in frame.columns],
        table_rows=frame_to_preview_rows(frame, limit=8),
        status="success",
        message="Chart data prepared successfully.",
    )


async def save_dataset_upload(file: UploadFile, owner_id: str | None) -> DatasetUploadResponse:
    suffix, file_type = validate_dataset_file(file)
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    upload_dir = Path(settings.upload_dir)
    metadata_dir = Path(settings.metadata_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    metadata_dir.mkdir(parents=True, exist_ok=True)

    dataset_id = uuid4().hex
    stored_filename = f"{dataset_id}{suffix}"
    destination = upload_dir / stored_filename
    digest = hashlib.sha256()
    total_size = 0

    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds {settings.max_upload_size_mb}MB limit.",
                    )
                digest.update(chunk)
                output.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty. Download the file locally first if it is stored in OneDrive.",
            )

        rows, columns = parse_dataset(destination, suffix)
    except Exception:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        await file.close()

    uploaded_at = datetime.now(UTC).isoformat()
    response = DatasetUploadResponse(
        id=dataset_id,
        file_name=file.filename or stored_filename,
        file_type=file_type,
        file_size=total_size,
        sha256=digest.hexdigest(),
        uploaded_at=uploaded_at,
        rows=rows,
        columns=columns,
        status="success",
        message="Dataset uploaded and parsed successfully.",
    )

    metadata = response.model_dump()
    metadata["owner_id"] = owner_id
    metadata["stored_filename"] = stored_filename

    with metadata_path().open("a", encoding="utf-8") as metadata_file:
        metadata_file.write(json.dumps(metadata) + "\n")

    return response
