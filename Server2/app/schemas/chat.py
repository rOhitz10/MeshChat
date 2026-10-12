from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000, description="Message text content")
    message_type: str = Field(default="text", description="Type of message: text, image, file, system")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    content: str
    message_type: str = "text"
    created_at: datetime
    read_by: List[str] = Field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None


class ConversationCreate(BaseModel):
    participant_ids: List[str] = Field(..., min_length=1, description="List of participant user IDs")
    is_group: bool = Field(default=False, description="Whether this is a group chat")
    title: Optional[str] = Field(default=None, max_length=100, description="Chat or group title")


class ConversationOut(BaseModel):
    id: str
    title: Optional[str] = None
    is_group: bool = False
    participants: List[Dict[str, Any]]
    last_message: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
