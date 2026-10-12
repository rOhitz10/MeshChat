import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger("meshchat.ws")


class ConnectionManager:
    """
    Production-grade WebSocket connection manager supporting:
    - Multiple connections/devices per user
    - Room-based broadcasts (per conversation)
    - Online/offline presence notifications
    - Direct peer-to-peer delivery
    """

    def __init__(self):
        # Maps user_id -> Set of active WebSocket instances
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps conversation_id -> Set of user_ids currently focused/subscribed
        self.room_subscribers: Dict[str, Set[str]] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        """Register and accept a new websocket client connection."""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
            # First connection for this user: announce online status
            await self.broadcast_presence(user_id, is_online=True)

        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected (total sockets: {len(self.active_connections[user_id])})")

        # Send welcome/acknowledgement packet
        await self.send_personal_message(
            user_id=user_id,
            message={
                "event": "connection_ack",
                "data": {
                    "user_id": user_id,
                    "connected_at": datetime.now(timezone.utc).isoformat(),
                    "server": "MeshChat FastAPI Server",
                },
            },
        )

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        """Remove a disconnected websocket client."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # User has no remaining active connections: announce offline
                await self.broadcast_presence(user_id, is_online=False)

        # Cleanup from rooms
        for conv_id, members in list(self.room_subscribers.items()):
            members.discard(user_id)
            if not members:
                del self.room_subscribers[conv_id]

        logger.info(f"User {user_id} disconnected.")

    def is_user_online(self, user_id: str) -> bool:
        """Check if a specific user is currently connected."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0

    def get_online_users(self) -> List[str]:
        """Return list of all currently connected user IDs."""
        return list(self.active_connections.keys())

    async def send_personal_message(self, user_id: str, message: Dict[str, Any]) -> None:
        """Send message to all sockets registered to a user."""
        if user_id not in self.active_connections:
            return

        dead_sockets: List[WebSocket] = []
        payload = json.dumps(message, default=str)

        for socket in self.active_connections[user_id]:
            try:
                await socket.send_text(payload)
            except Exception as e:
                logger.warning(f"Error sending message to user {user_id}: {e}")
                dead_sockets.append(socket)

        for dead in dead_sockets:
            self.active_connections[user_id].discard(dead)

    async def broadcast_to_conversation(
        self,
        conversation_id: str,
        participant_ids: List[str],
        message: Dict[str, Any],
        exclude_user_id: Optional[str] = None,
    ) -> None:
        """Broadcast an event to all participants in a conversation."""
        for user_id in participant_ids:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            await self.send_personal_message(user_id, message)

    async def broadcast_presence(self, user_id: str, is_online: bool) -> None:
        """Notify all connected users about a user's presence state change."""
        payload = {
            "event": "user_status",
            "data": {
                "user_id": user_id,
                "is_online": is_online,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
        raw_text = json.dumps(payload, default=str)

        for uid, sockets in list(self.active_connections.items()):
            if uid == user_id:
                continue
            for s in list(sockets):
                try:
                    await s.send_text(raw_text)
                except Exception:
                    pass


# Global singleton instance
ws_manager = ConnectionManager()
