from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    avatar: Optional[str] = ""
    bio: Optional[str] = ""
    isVerified: bool = False
    isOnline: bool = False
    lastSeen: Optional[datetime] = None
    created_at: Optional[datetime] = None


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=50)
    avatar: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=150)
