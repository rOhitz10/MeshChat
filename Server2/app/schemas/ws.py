from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class WSEvent(BaseModel):
    event: str = Field(..., description="Event name (e.g., ping, send_message, typing)")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Payload data")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
