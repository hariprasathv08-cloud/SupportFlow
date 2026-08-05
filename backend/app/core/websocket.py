import asyncio
import json
from fastapi import WebSocket
from typing import Dict, Set, List
from sqlalchemy.orm import Session

class ConnectionManager:
    def __init__(self):
        # Maps user_id to a set of active WebSockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Keeps track of all online user IDs
        self.online_users: Set[int] = set()

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        
        # If this is the first connection for this user, broadcast that they are online
        if user_id not in self.online_users:
            self.online_users.add(user_id)
            await self.broadcast_online_status(user_id, is_online=True)

    async def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                if user_id in self.online_users:
                    self.online_users.remove(user_id)
                    await self.broadcast_online_status(user_id, is_online=False)

    async def broadcast(self, message: dict):
        for user_id, sockets in list(self.active_connections.items()):
            for socket in list(sockets):
                try:
                    await socket.send_json(message)
                except Exception:
                    self.active_connections[user_id].discard(socket)

    async def broadcast_online_status(self, user_id: int, is_online: bool):
        await self.broadcast({
            "type": "online_status",
            "user_id": user_id,
            "status": "online" if is_online else "offline"
        })

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            for socket in list(self.active_connections[user_id]):
                try:
                    await socket.send_json(message)
                except Exception:
                    self.active_connections[user_id].discard(socket)

    def get_ticket_participant_ids(self, ticket, db: Session) -> List[int]:
        # Participants are: Employee (created_by_id), Tech (assigned_to_id), and all Admins
        participants = {ticket.created_by_id}
        if ticket.assigned_to_id:
            participants.add(ticket.assigned_to_id)
        
        # Add all Admins (Super Administrator, Administrator, Admin)
        from app.models.user import User, Role
        admins = db.query(User).join(Role).filter(Role.name.in_(["Admin", "Super Administrator", "Administrator"])).all()
        for admin in admins:
            participants.add(admin.id)
            
        return list(participants)

    async def send_to_ticket_participants(self, ticket, message: dict, db: Session):
        participant_ids = self.get_ticket_participant_ids(ticket, db)
        for user_id in participant_ids:
            await self.send_to_user(user_id, message)

manager = ConnectionManager()
