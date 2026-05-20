from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class StudyContext(Base):
    __tablename__ = "study_contexts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[str] = mapped_column(String(255), index=True)
    dataset_id: Mapped[str] = mapped_column(String(255), index=True)
    owner_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    drug_name: Mapped[str] = mapped_column(String(255))
    study_type: Mapped[str] = mapped_column(String(255))
    indication: Mapped[str] = mapped_column(String(255))
    target_population: Mapped[str] = mapped_column(Text)
    study_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    study_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

