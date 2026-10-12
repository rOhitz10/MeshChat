from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.chat import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
)
from app.services.chat_service import ChatService

router = APIRouter()


@router.get("", response_model=List[ConversationOut], summary="List my conversations")
async def list_conversations(
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Retrieve all conversations the current user is part of."""
    return await ChatService.list_conversations(
        db=db,
        user_id=current_user["id"],
        limit=limit,
        skip=skip,
    )


@router.post(
    "",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create or get conversation",
)
async def create_conversation(
    dto: ConversationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create a new direct or group conversation, or fetch existing direct thread."""
    return await ChatService.create_or_get_conversation(
        db=db,
        current_user_id=current_user["id"],
        dto=dto,
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=List[MessageOut],
    summary="Get conversation messages",
)
async def get_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    skip: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Fetch message history for a conversation in chronological order."""
    return await ChatService.get_messages(
        db=db,
        conversation_id=conversation_id,
        user_id=current_user["id"],
        limit=limit,
        skip=skip,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send message (REST)",
)
async def send_message(
    conversation_id: str,
    dto: MessageCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send a message via HTTP REST and broadcast to connected WebSocket peers."""
    return await ChatService.send_message(
        db=db,
        conversation_id=conversation_id,
        sender_id=current_user["id"],
        sender_name=current_user.get("name", "User"),
        dto=dto,
    )
