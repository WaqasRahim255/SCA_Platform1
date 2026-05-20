from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    active_projects: int
    uploaded_datasets: int
    active_sessions: int
    chat_messages: int
    status: str
    message: str
