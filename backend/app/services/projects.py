import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.project import Project
from app.schemas.project import ProjectCreateRequest, ProjectListResponse, ProjectResponse


def _ensure_project_table(db: Session) -> None:
    Project.__table__.create(db.bind, checkfirst=True)


def _to_response(project: Project) -> ProjectResponse:
    return ProjectResponse(
        id=str(project.id),
        name=project.name,
        description=project.description,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        saved_to="database",
    )


def _projects_fallback_path() -> Path:
    Path(settings.metadata_dir).mkdir(parents=True, exist_ok=True)
    return Path(settings.metadata_dir) / "projects.jsonl"


def _fallback_record_to_response(record: dict[str, object]) -> ProjectResponse:
    return ProjectResponse(
        id=str(record["id"]),
        name=str(record["name"]),
        description=str(record["description"]) if record.get("description") is not None else None,
        status=str(record["status"]),
        created_at=datetime.fromisoformat(str(record["created_at"])),
        updated_at=datetime.fromisoformat(str(record["updated_at"])),
        saved_to="local",
    )


def _create_project_fallback(
    payload: ProjectCreateRequest,
    owner_id: str | None,
) -> ProjectResponse:
    created_at = datetime.now(UTC).isoformat()
    record = {
        "id": uuid4().hex,
        "owner_id": owner_id,
        "name": payload.name,
        "description": payload.description,
        "status": "active",
        "created_at": created_at,
        "updated_at": created_at,
    }

    with _projects_fallback_path().open("a", encoding="utf-8") as projects_file:
        projects_file.write(json.dumps(record) + "\n")

    return _fallback_record_to_response(record)


def _list_projects_fallback(owner_id: str | None) -> ProjectListResponse:
    path = _projects_fallback_path()
    projects: list[ProjectResponse] = []

    if path.exists():
        with path.open("r", encoding="utf-8") as projects_file:
            for line in projects_file:
                if not line.strip():
                    continue

                record = json.loads(line)
                if record.get("owner_id") == owner_id:
                    projects.append(_fallback_record_to_response(record))

    projects.sort(key=lambda project: project.created_at, reverse=True)
    return ProjectListResponse(projects=projects)


def create_project(
    payload: ProjectCreateRequest,
    owner_id: str | None,
    db: Session,
) -> ProjectResponse:
    try:
        _ensure_project_table(db)

        project = Project(
            owner_id=owner_id,
            name=payload.name,
            description=payload.description,
            status="active",
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        return _to_response(project)
    except SQLAlchemyError:
        db.rollback()
        return _create_project_fallback(payload, owner_id)


def list_projects(owner_id: str | None, db: Session) -> ProjectListResponse:
    try:
        _ensure_project_table(db)

        statement = (
            select(Project)
            .where(Project.owner_id == owner_id)
            .order_by(Project.created_at.desc(), Project.id.desc())
        )
        projects = db.scalars(statement).all()

        return ProjectListResponse(projects=[_to_response(project) for project in projects])
    except SQLAlchemyError:
        db.rollback()
        return _list_projects_fallback(owner_id)
