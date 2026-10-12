from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50, description="User full name")
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, description="Password with minimum 6 characters")
    avatar: Optional[str] = Field(default="", description="Optional avatar URL")
    bio: Optional[str] = Field(default="", max_length=150, description="Short bio")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    userId: str
    username: str
    userEmail: str
