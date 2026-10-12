import json
import logging
from typing import Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from app.core.database import DatabaseManager
from app.core.dependencies import get_current_user_from_token
from app.schemas.chat import MessageCreate
from app.services.chat_service import ChatService
from app.services.connection_manager import ws_manager

logger = logging.getLogger("meshchat.ws_router")
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    Real-time WebSocket connection for chat and presence.
    Authenticate via query param ?token=<jwt_access_token>
    """
    db = DatabaseManager.get_db()

    # Authenticate client
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Missing token")
        return

    user = await get_current_user_from_token(token, db)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return

    user_id = user["id"]
    await ws_manager.connect(user_id, websocket)

    try:
        while True:
            text = await websocket.receive_text()
            try:
                packet = json.loads(text)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"event": "error", "message": "Invalid JSON"}))
                continue

            event = packet.get("event")
            data = packet.get("data", {})

            # 1. Ping / Heartbeat
            if event == "ping":
                await websocket.send_text(json.dumps({
                    "event": "pong",
                    "data": {"timestamp": packet.get("timestamp")},
                }))

            # 2. Real-time chat message
            elif event == "send_message":
                conv_id = data.get("conversation_id")
                content = data.get("content", "").strip()
                msg_type = data.get("message_type", "text")

                if conv_id and content:
                    msg_dto = MessageCreate(content=content, message_type=msg_type)
                    saved_msg = await ChatService.send_message(
                        db=db,
                        conversation_id=conv_id,
                        sender_id=user_id,
                        sender_name=user.get("name", "User"),
                        dto=msg_dto,
                    )
                    # Acknowledge to sender
                    await websocket.send_text(json.dumps({
                        "event": "message_sent",
                        "data": saved_msg.model_dump(mode="json"),
                    }))

            # 3. Typing indicator
            elif event == "typing":
                conv_id = data.get("conversation_id")
                is_typing = data.get("is_typing", True)
                if conv_id:
                    conv = await db["conversations"].find_one({"_id": conv_id})
                    if not conv and hasattr(conv_id, "__len__"):
                        from bson import ObjectId
                        if ObjectId.is_valid(conv_id):
                            conv = await db["conversations"].find_one({"_id": ObjectId(conv_id)})

                    if conv:
                        parts = conv.get("participants", [])
                        await ws_manager.broadcast_to_conversation(
                            conversation_id=conv_id,
                            participant_ids=parts,
                            message={
                                "event": "user_typing",
                                "data": {
                                    "conversation_id": conv_id,
                                    "user_id": user_id,
                                    "user_name": user.get("name", "User"),
                                    "is_typing": is_typing,
                                },
                            },
                            exclude_user_id=user_id,
                        )

            # 4. Unknown event
            else:
                logger.debug(f"Received unhandled event '{event}' from user {user_id}")

    except WebSocketDisconnect:
        await ws_manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        await ws_manager.disconnect(user_id, websocket)
