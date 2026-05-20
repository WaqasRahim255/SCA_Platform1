from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_current_user
from app.db.session import get_db
from app.schemas.dataset import (
    DatasetAnalysisResponse,
    DatasetChartResponse,
    DatasetCleaningAnalysisResponse,
    DatasetMetadataResponse,
    DatasetPreviewResponse,
    DatasetUploadResponse,
)
from app.schemas.dashboard import DashboardSummaryResponse
from app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ChatMessagesResponse
from app.schemas.project import ProjectCreateRequest, ProjectListResponse, ProjectResponse
from app.schemas.study_context import StudyContextRequest, StudyContextResponse
from app.services.chat import get_chat_messages, save_chat_message
from app.services.datasets import (
    analyse_dataset,
    analyse_dataset_cleaning,
    get_dataset_chart,
    get_dataset_metadata,
    get_dataset_preview,
    save_dataset_upload,
)
from app.services.dashboard import get_dashboard_summary
from app.services.projects import create_project, list_projects
from app.services.study_contexts import save_study_context

router = APIRouter()


@router.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "sca-platform-api", "docs": "/docs"}


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "sca-platform-api"}


@router.get("/health/database")
def database_health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PostgreSQL is not reachable.",
        ) from exc

    return {"status": "ok", "database": "postgresql"}


@router.get("/auth/public")
def auth_public_test() -> dict[str, str]:
    return {"status": "ok", "message": "Public auth test endpoint is reachable."}


@router.get("/auth/optional")
def auth_optional_test(
    current_user: dict[str, object] | None = Depends(get_current_user),
) -> dict[str, object]:
    return {
        "authenticated": current_user is not None,
        "user": current_user.get("sub") if current_user else None,
        "auth": "optional",
    }


@router.get("/auth/me")
def auth_me(current_user: dict[str, object] = Depends(require_current_user)) -> dict[str, object]:
    return {
        "authenticated": True,
        "user": current_user.get("sub"),
        "auth": "clerk-jwt",
    }


@router.get("/api/dashboard/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryResponse:
    return get_dashboard_summary(
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )


@router.post("/api/projects", response_model=ProjectResponse)
def create_project_endpoint(
    payload: ProjectCreateRequest,
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    return create_project(
        payload=payload,
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )


@router.get("/api/projects", response_model=ProjectListResponse)
def list_projects_endpoint(
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ProjectListResponse:
    return list_projects(
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )


@router.post("/api/datasets/upload", response_model=DatasetUploadResponse)
async def upload_dataset(
    file: UploadFile,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetUploadResponse:
    return await save_dataset_upload(file, owner_id=str(current_user.get("sub", "")))


@router.get("/api/datasets/{dataset_id}", response_model=DatasetMetadataResponse)
def dataset_metadata(
    dataset_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetMetadataResponse:
    return get_dataset_metadata(dataset_id, owner_id=str(current_user.get("sub", "")))


@router.get("/api/datasets/{dataset_id}/preview", response_model=DatasetPreviewResponse)
def preview_dataset(
    dataset_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetPreviewResponse:
    return get_dataset_preview(dataset_id, owner_id=str(current_user.get("sub", "")))


@router.get("/api/datasets/{dataset_id}/analysis", response_model=DatasetAnalysisResponse)
def dataset_analysis(
    dataset_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetAnalysisResponse:
    return analyse_dataset(dataset_id, owner_id=str(current_user.get("sub", "")))


@router.get("/api/datasets/{dataset_id}/chart", response_model=DatasetChartResponse)
def dataset_chart(
    dataset_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetChartResponse:
    return get_dataset_chart(dataset_id, owner_id=str(current_user.get("sub", "")))


@router.post("/api/datasets/{dataset_id}/clean/analyse", response_model=DatasetCleaningAnalysisResponse)
def analyse_dataset_cleaning_endpoint(
    dataset_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
) -> DatasetCleaningAnalysisResponse:
    return analyse_dataset_cleaning(dataset_id, owner_id=str(current_user.get("sub", "")))


@router.post("/api/projects/{project_id}/context", response_model=StudyContextResponse)
def save_project_context(
    project_id: str,
    payload: StudyContextRequest,
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> StudyContextResponse:
    return save_study_context(
        project_id=project_id,
        payload=payload,
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )


@router.post("/api/chat/messages", response_model=ChatMessageResponse)
def create_chat_message(
    payload: ChatMessageRequest,
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ChatMessageResponse:
    return save_chat_message(
        payload=payload,
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )


@router.get("/api/chat/messages/{project_id}", response_model=ChatMessagesResponse)
def list_chat_messages(
    project_id: str,
    current_user: dict[str, object] = Depends(require_current_user),
    db: Session = Depends(get_db),
) -> ChatMessagesResponse:
    return get_chat_messages(
        project_id=project_id,
        owner_id=str(current_user.get("sub", "")),
        db=db,
    )
