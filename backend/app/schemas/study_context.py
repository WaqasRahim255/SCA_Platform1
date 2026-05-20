from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator


class StudyContextRequest(BaseModel):
    dataset_id: str
    drug_name: str = Field(min_length=1, max_length=255)
    study_type: str = Field(min_length=1, max_length=255)
    indication: str = Field(min_length=1, max_length=255)
    target_population: str = Field(min_length=1)
    study_start_date: date | None = None
    study_end_date: date | None = None
    additional_notes: str | None = None

    @field_validator("study_start_date", "study_end_date", mode="before")
    @classmethod
    def parse_flexible_date(cls, value: Any) -> Any:
        if value in {"", None}:
            return None

        if isinstance(value, str) and "/" in value:
            month, day, year = value.split("/")
            return date(int(year), int(month), int(day))

        return value


class StudyContextResponse(BaseModel):
    id: str
    project_id: str
    dataset_id: str
    drug_name: str
    study_type: str
    indication: str
    target_population: str
    study_start_date: date | None
    study_end_date: date | None
    additional_notes: str | None
    saved_to: str
    status: str
    message: str
