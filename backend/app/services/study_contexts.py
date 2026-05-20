import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.study_context import StudyContext
from app.schemas.study_context import StudyContextRequest, StudyContextResponse


def save_context_fallback(
    context_id: str,
    project_id: str,
    payload: StudyContextRequest,
    owner_id: str | None,
) -> None:
    Path(settings.metadata_dir).mkdir(parents=True, exist_ok=True)
    record = payload.model_dump(mode="json")
    record.update(
        {
            "id": context_id,
            "project_id": project_id,
            "owner_id": owner_id,
            "saved_at": datetime.now(UTC).isoformat(),
        }
    )

    with (Path(settings.metadata_dir) / "study_contexts.jsonl").open(
        "a",
        encoding="utf-8",
    ) as context_file:
        context_file.write(json.dumps(record) + "\n")


def save_study_context(
    project_id: str,
    payload: StudyContextRequest,
    owner_id: str | None,
    db: Session,
) -> StudyContextResponse:
    context_id = uuid4().hex
    saved_to = "database"

    try:
        StudyContext.__table__.create(db.bind, checkfirst=True)
        context = StudyContext(
            project_id=project_id,
            dataset_id=payload.dataset_id,
            owner_id=owner_id,
            drug_name=payload.drug_name,
            study_type=payload.study_type,
            indication=payload.indication,
            target_population=payload.target_population,
            study_start_date=payload.study_start_date,
            study_end_date=payload.study_end_date,
            additional_notes=payload.additional_notes,
        )
        db.add(context)
        db.commit()
        db.refresh(context)
        context_id = str(context.id)
    except SQLAlchemyError:
        db.rollback()
        saved_to = "local"
        save_context_fallback(context_id, project_id, payload, owner_id)

    return StudyContextResponse(
        id=context_id,
        project_id=project_id,
        dataset_id=payload.dataset_id,
        drug_name=payload.drug_name,
        study_type=payload.study_type,
        indication=payload.indication,
        target_population=payload.target_population,
        study_start_date=payload.study_start_date,
        study_end_date=payload.study_end_date,
        additional_notes=payload.additional_notes,
        saved_to=saved_to,
        status="success",
        message=f"Study context saved to {saved_to}.",
    )
