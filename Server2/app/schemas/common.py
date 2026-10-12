from datetime import datetime, timezone
from typing import Any, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

DataT = TypeVar("DataT")


class HealthCheckResponse(BaseModel):
    status: str = "ok"
    server: str = "MeshChat FastAPI Server (Server 2)"
    version: str = "1.0.0"
    database_connected: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class APIResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "Success"
    data: Optional[DataT] = None
