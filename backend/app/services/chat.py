import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ChatMessagesResponse


def _ensure_chat_table(db: Session) -> None:
    ChatMessage.__table__.create(db.bind, checkfirst=True)


def _to_response(message: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(message.id),
        project_id=message.project_id,
        role=message.role,  # type: ignore[arg-type]
        mode=message.mode,  # type: ignore[arg-type]
        content=message.content,
        attachment_name=message.attachment_name,
        created_at=message.created_at,
        saved_to="database",
    )


def _chat_fallback_path() -> Path:
    Path(settings.metadata_dir).mkdir(parents=True, exist_ok=True)
    return Path(settings.metadata_dir) / "chat_messages.jsonl"


def _fallback_record_to_response(record: dict[str, object]) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=str(record["id"]),
        project_id=str(record["project_id"]),
        role=str(record["role"]),  # type: ignore[arg-type]
        mode=str(record["mode"]),  # type: ignore[arg-type]
        content=str(record["content"]),
        attachment_name=(
            str(record["attachment_name"])
            if record.get("attachment_name") is not None
            else None
        ),
        created_at=datetime.fromisoformat(str(record["created_at"])),
        saved_to="local",
    )


def _save_chat_message_fallback(
    payload: ChatMessageRequest,
    owner_id: str | None,
) -> ChatMessageResponse:
    record = {
        "id": uuid4().hex,
        "project_id": payload.project_id,
        "owner_id": owner_id,
        "role": payload.role,
        "mode": payload.mode,
        "content": payload.content,
        "attachment_name": payload.attachment_name,
        "created_at": datetime.now(UTC).isoformat(),
    }

    with _chat_fallback_path().open("a", encoding="utf-8") as messages_file:
        messages_file.write(json.dumps(record) + "\n")

    return _fallback_record_to_response(record)


def _get_chat_messages_fallback(project_id: str, owner_id: str | None) -> ChatMessagesResponse:
    path = _chat_fallback_path()
    messages: list[ChatMessageResponse] = []

    if path.exists():
        with path.open("r", encoding="utf-8") as messages_file:
            for line in messages_file:
                if not line.strip():
                    continue

                record = json.loads(line)
                if record.get("project_id") == project_id and record.get("owner_id") == owner_id:
                    messages.append(_fallback_record_to_response(record))

    return ChatMessagesResponse(project_id=project_id, messages=messages)


def save_chat_message(
    payload: ChatMessageRequest,
    owner_id: str | None,
    db: Session,
) -> ChatMessageResponse:
    try:
        _ensure_chat_table(db)

        message = ChatMessage(
            project_id=payload.project_id,
            owner_id=owner_id,
            role=payload.role,
            mode=payload.mode,
            content=payload.content,
            attachment_name=payload.attachment_name,
        )
        db.add(message)
        db.commit()
        db.refresh(message)

        return _to_response(message)
    except SQLAlchemyError:
        db.rollback()
        return _save_chat_message_fallback(payload, owner_id)


def get_chat_messages(
    project_id: str,
    owner_id: str | None,
    db: Session,
) -> ChatMessagesResponse:
    try:
        _ensure_chat_table(db)

        statement = (
            select(ChatMessage)
            .where(ChatMessage.project_id == project_id, ChatMessage.owner_id == owner_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        )
        messages = db.scalars(statement).all()

        return ChatMessagesResponse(
            project_id=project_id,
            messages=[_to_response(message) for message in messages],
        )
    except SQLAlchemyError:
        db.rollback()
        return _get_chat_messages_fallback(project_id, owner_id)
