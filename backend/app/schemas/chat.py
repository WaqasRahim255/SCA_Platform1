from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ChatRole = Literal["user", "assistant", "system"]
ChatMode = Literal["planning", "editing", "answering"]


class ChatMessageRequest(BaseModel):
    project_id: str = Field(min_length=1, max_length=255)
    content: str = Field(min_length=1)
    role: ChatRole = "user"
    mode: ChatMode = "planning"
    attachment_name: str | None = Field(default=None, max_length=512)


class ChatMessageResponse(BaseModel):
    id: str
    project_id: str
    role: ChatRole
    mode: ChatMode
    content: str
    attachment_name: str | None
    created_at: datetime
    saved_to: str = "database"


class ChatMessagesResponse(BaseModel):
    project_id: str
    messages: list[ChatMessageResponse]
