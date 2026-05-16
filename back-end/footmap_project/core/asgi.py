"""
ASGI config for core project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os
import sys
from pathlib import Path
import django
from django.core.asgi import get_asgi_application

# 1. Thiết lập đường dẫn (Phải làm đầu tiên)
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
if str(BASE_DIR / 'apps') not in sys.path:
    sys.path.insert(0, str(BASE_DIR / 'apps'))

# 2. Thiết lập môi trường settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

# 3. KHỞI TẠO HTTP APPLICATION TRƯỚC
# Dòng này sẽ giúp nạp các settings và khởi tạo registry ngầm định
django_asgi_app = get_asgi_application()

# 4. BÂY GIỜ MỚI IMPORT CÁC THÀNH PHẦN KHÁC
# (Chỉ import sau khi get_asgi_application() đã được gọi)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path

# Thử import consumer
try:
    from apps.user.consumers import LoginControlConsumer
except RuntimeError as e:
    from user.consumers import LoginControlConsumer

# 5. ĐỊNH NGHĨA PROTOCOL ROUTER
application = ProtocolTypeRouter({
    # Sử dụng cái django_asgi_app đã khởi tạo ở bước 3 cho http
    "http": django_asgi_app,
    
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/session/<uuid:session_id>/", LoginControlConsumer.as_asgi()),
        ])
    ),
})
