import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import UserSession

class LoginControlConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        
        # Kiểm tra session_id có tồn tại trong DB không
        session_exists = await self.check_session_exists(self.session_id)

        if session_exists:
            await self.accept()
            # Cập nhật trạng thái session là đang hoạt động (is_revoked=False)
            await self.update_session_status(self.session_id, False)
        else:
            # Nếu session_id giả mạo hoặc không tồn tại -> Từ chối
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, 'session_id'):
            await self.update_session_status(self.session_id, True)

    @database_sync_to_async
    def check_session_exists(self, session_id):
        return UserSession.objects.filter(session_id=session_id).exists()

    @database_sync_to_async
    def update_session_status(self, session_id, status):
        UserSession.objects.filter(session_id=session_id).update(is_revoked=status)