from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.chat import (
    ConversationCreate,
    ConversationOut,
    MessageCreate,
    MessageOut,
)
from app.services.connection_manager import ws_manager


class ChatService:
    @staticmethod
    def _parse_id(val: Any) -> str:
        return str(val) if val else ""

    @classmethod
    async def _populate_participants(
        cls, db: AsyncIOMotorDatabase, participant_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Fetch basic public info for list of participant IDs."""
        object_ids = [ObjectId(uid) for uid in participant_ids if ObjectId.is_valid(uid)]
        raw_ids = [uid for uid in participant_ids if not ObjectId.is_valid(uid)]

        cursor = db["users"].find(
            {"$or": [{"_id": {"$in": object_ids}}, {"_id": {"$in": raw_ids}}]},
            {"password": 0},
        )
        users = await cursor.to_list(length=100)

        participants_map = {str(u["_id"]): u for u in users}
        result = []
        for pid in participant_ids:
            u = participants_map.get(str(pid))
            if u:
                result.append({
                    "id": str(u["_id"]),
                    "name": u.get("name", "Unknown"),
                    "email": u.get("email", ""),
                    "avatar": u.get("avatar", ""),
                    "isOnline": ws_manager.is_user_online(str(u["_id"])),
                })
            else:
                result.append({
                    "id": str(pid),
                    "name": "User",
                    "email": "",
                    "avatar": "",
                    "isOnline": False,
                })
        return result

    @classmethod
    async def create_or_get_conversation(
        cls, db: AsyncIOMotorDatabase, current_user_id: str, dto: ConversationCreate
    ) -> ConversationOut:
        """Create a new conversation or retrieve existing direct chat."""
        # Include current user in participants
        all_participants = list(set([current_user_id] + dto.participant_ids))

        # If direct conversation (2 users), check if already exists
        if not dto.is_group and len(all_participants) == 2:
            existing = await db["conversations"].find_one({
                "is_group": False,
                "participants": {"$all": all_participants, "$size": 2},
            })
            if existing:
                parts = await cls._populate_participants(db, existing["participants"])
                return ConversationOut(
                    id=str(existing["_id"]),
                    title=existing.get("title"),
                    is_group=False,
                    participants=parts,
                    last_message=existing.get("last_message"),
                    created_at=existing.get("createdAt", datetime.now(timezone.utc)),
                    updated_at=existing.get("updatedAt", datetime.now(timezone.utc)),
                )

        now = datetime.now(timezone.utc)
        doc: Dict[str, Any] = {
            "title": dto.title,
            "is_group": dto.is_group,
            "participants": all_participants,
            "last_message": None,
            "createdAt": now,
            "updatedAt": now,
        }

        res = await db["conversations"].insert_one(doc)
        conv_id = str(res.inserted_id)
        parts = await cls._populate_participants(db, all_participants)

        return ConversationOut(
            id=conv_id,
            title=dto.title,
            is_group=dto.is_group,
            participants=parts,
            last_message=None,
            created_at=now,
            updated_at=now,
        )

    @classmethod
    async def list_conversations(
        cls, db: AsyncIOMotorDatabase, user_id: str, limit: int = 50, skip: int = 0
    ) -> List[ConversationOut]:
        """List all conversations for the user sorted by recent activity."""
        cursor = (
            db["conversations"]
            .find({"participants": user_id})
            .sort("updatedAt", -1)
            .skip(skip)
            .limit(limit)
        )
        convs = await cursor.to_list(length=limit)

        results: List[ConversationOut] = []
        for c in convs:
            parts = await cls._populate_participants(db, c.get("participants", []))
            results.append(
                ConversationOut(
                    id=str(c["_id"]),
                    title=c.get("title"),
                    is_group=c.get("is_group", False),
                    participants=parts,
                    last_message=c.get("last_message"),
                    created_at=c.get("createdAt", datetime.now(timezone.utc)),
                    updated_at=c.get("updatedAt", datetime.now(timezone.utc)),
                )
            )
        return results

    @classmethod
    async def send_message(
        cls,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        sender_id: str,
        sender_name: str,
        dto: MessageCreate,
    ) -> MessageOut:
        """Post a new message to a conversation and broadcast to active participants."""
        conv_query = {"_id": ObjectId(conversation_id)} if ObjectId.is_valid(conversation_id) else {"_id": conversation_id}
        conv = await db["conversations"].find_one(conv_query)

        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if sender_id not in conv.get("participants", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this conversation",
            )

        now = datetime.now(timezone.utc)
        msg_doc: Dict[str, Any] = {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": dto.content,
            "message_type": dto.message_type,
            "read_by": [sender_id],
            "metadata": dto.metadata or {},
            "createdAt": now,
        }

        res = await db["messages"].insert_one(msg_doc)
        msg_id = str(res.inserted_id)

        # Update conversation's last message summary
        last_msg_summary = {
            "id": msg_id,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": dto.content[:100],
            "created_at": now.isoformat(),
        }
        await db["conversations"].update_one(
            conv_query,
            {"$set": {"last_message": last_msg_summary, "updatedAt": now}},
        )

        message_out = MessageOut(
            id=msg_id,
            conversation_id=conversation_id,
            sender_id=sender_id,
            sender_name=sender_name,
            content=dto.content,
            message_type=dto.message_type,
            created_at=now,
            read_by=[sender_id],
            metadata=dto.metadata,
        )

        # Broadcast live event to participants via WebSockets
        participants = conv.get("participants", [])
        await ws_manager.broadcast_to_conversation(
            conversation_id=conversation_id,
            participant_ids=participants,
            message={
                "event": "new_message",
                "data": message_out.model_dump(mode="json"),
            },
            exclude_user_id=sender_id,
        )

        return message_out

    @classmethod
    async def get_messages(
        cls,
        db: AsyncIOMotorDatabase,
        conversation_id: str,
        user_id: str,
        limit: int = 50,
        skip: int = 0,
    ) -> List[MessageOut]:
        """Fetch paginated messages for a conversation."""
        conv_query = {"_id": ObjectId(conversation_id)} if ObjectId.is_valid(conversation_id) else {"_id": conversation_id}
        conv = await db["conversations"].find_one(conv_query)

        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )

        if user_id not in conv.get("participants", []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to view messages in this conversation",
            )

        cursor = (
            db["messages"]
            .find({"conversation_id": conversation_id})
            .sort("createdAt", -1)
            .skip(skip)
            .limit(limit)
        )
        raw_messages = await cursor.to_list(length=limit)
        # Reverse to return in chronological order
        raw_messages.reverse()

        return [
            MessageOut(
                id=str(m["_id"]),
                conversation_id=m["conversation_id"],
                sender_id=m["sender_id"],
                sender_name=m.get("sender_name", "User"),
                content=m["content"],
                message_type=m.get("message_type", "text"),
                created_at=m.get("createdAt", datetime.now(timezone.utc)),
                read_by=m.get("read_by", []),
                metadata=m.get("metadata"),
            )
            for m in raw_messages
        ]
