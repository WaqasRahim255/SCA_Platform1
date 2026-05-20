import json
from pathlib import Path

from sqlalchemy import distinct, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.models.project import Project
from app.schemas.dashboard import DashboardSummaryResponse


def _metadata_file(name: str) -> Path:
    return Path(settings.metadata_dir) / name


def _record_belongs_to_owner(record: dict[str, object], owner_id: str | None) -> bool:
    if not owner_id:
        return True

    return record.get("owner_id") in {owner_id, None, ""}


def _count_dataset_metadata(owner_id: str | None) -> int:
    path = _metadata_file("datasets.jsonl")
    if not path.exists():
        return 0

    count = 0
    with path.open("r", encoding="utf-8") as metadata_file:
        for line in metadata_file:
            if not line.strip():
                continue

            record = json.loads(line)
            if _record_belongs_to_owner(record, owner_id):
                count += 1

    return count


def _count_fallback_projects(owner_id: str | None) -> int:
    path = _metadata_file("projects.jsonl")
    if not path.exists():
        return 0

    count = 0
    with path.open("r", encoding="utf-8") as projects_file:
        for line in projects_file:
            if not line.strip():
                continue

            record = json.loads(line)
            if _record_belongs_to_owner(record, owner_id) and record.get("status") == "active":
                count += 1

    return count


def _count_fallback_chat(owner_id: str | None) -> tuple[int, int]:
    path = _metadata_file("chat_messages.jsonl")
    if not path.exists():
        return 0, 0

    project_ids: set[str] = set()
    message_count = 0
    with path.open("r", encoding="utf-8") as messages_file:
        for line in messages_file:
            if not line.strip():
                continue

            record = json.loads(line)
            if not _record_belongs_to_owner(record, owner_id):
                continue

            message_count += 1
            project_ids.add(str(record.get("project_id", "")))

    project_ids.discard("")
    return len(project_ids), message_count


def get_dashboard_summary(owner_id: str | None, db: Session) -> DashboardSummaryResponse:
    uploaded_datasets = _count_dataset_metadata(owner_id)

    try:
        Project.__table__.create(db.bind, checkfirst=True)
        ChatMessage.__table__.create(db.bind, checkfirst=True)

        active_projects = int(
            db.scalar(
                select(func.count())
                .select_from(Project)
                .where(Project.owner_id == owner_id, Project.status == "active")
            )
            or 0
        )
        chat_messages = int(
            db.scalar(
                select(func.count())
                .select_from(ChatMessage)
                .where(ChatMessage.owner_id == owner_id)
            )
            or 0
        )
        active_sessions = int(
            db.scalar(
                select(func.count(distinct(ChatMessage.project_id))).where(
                    ChatMessage.owner_id == owner_id
                )
            )
            or 0
        )
    except SQLAlchemyError:
        db.rollback()
        active_projects = _count_fallback_projects(owner_id)
        active_sessions, chat_messages = _count_fallback_chat(owner_id)

    return DashboardSummaryResponse(
        active_projects=active_projects,
        uploaded_datasets=uploaded_datasets,
        active_sessions=active_sessions,
        chat_messages=chat_messages,
        status="success",
        message="Dashboard summary loaded successfully.",
    )
