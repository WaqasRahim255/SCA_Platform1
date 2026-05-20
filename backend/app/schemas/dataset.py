from pydantic import BaseModel


class DatasetUploadResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    sha256: str
    uploaded_at: str
    rows: int | None
    columns: int | None
    status: str
    message: str


class DatasetMetadataResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    sha256: str
    uploaded_at: str
    rows: int | None
    columns: int | None
    status: str
    message: str


class DatasetColumnPreview(BaseModel):
    name: str
    data_type: str
    null_percentage: float


class DatasetPreviewResponse(BaseModel):
    id: str
    file_name: str
    file_type: str
    file_size: int
    sha256: str
    integrity_verified: bool
    uploaded_at: str
    row_count: int
    column_count: int
    columns: list[DatasetColumnPreview]
    sample_rows: list[dict[str, object]]


class CleaningSuggestion(BaseModel):
    id: str
    type: str
    title: str
    description: str
    affected_columns: list[str]
    affected_rows: int
    strategy: str
    confidence: float


class DatasetCleaningAnalysisResponse(BaseModel):
    dataset_id: str
    analysed_at: str
    row_count: int
    column_count: int
    suggestions: list[CleaningSuggestion]
    status: str
    message: str


class DatasetNpsBreakdown(BaseModel):
    column: str
    total_responses: int
    promoters: int
    passives: int
    detractors: int
    promoter_percentage: float
    passive_percentage: float
    detractor_percentage: float
    score: float


class DatasetNumericSummary(BaseModel):
    column: str
    count: int
    mean: float | None
    median: float | None
    minimum: float | None
    maximum: float | None
    missing: int


class DatasetCategoricalSummary(BaseModel):
    column: str
    unique_values: int
    top_value: str | None
    top_count: int
    missing: int


class DatasetAnalysisResponse(BaseModel):
    dataset_id: str
    analysed_at: str
    row_count: int
    column_count: int
    duplicate_rows: int
    missing_cells: int
    missing_cell_percentage: float
    numeric_columns: int
    categorical_columns: int
    nps: DatasetNpsBreakdown | None
    numeric_summary: list[DatasetNumericSummary]
    categorical_summary: list[DatasetCategoricalSummary]
    status: str
    message: str


class DatasetChartResponse(BaseModel):
    dataset_id: str
    chart_type: str
    title: str
    x_label: str
    y_label: str
    x: list[object]
    y: list[object]
    table_columns: list[str]
    table_rows: list[dict[str, object]]
    status: str
    message: str
