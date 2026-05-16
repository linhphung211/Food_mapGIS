from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    # Endpoint để lấy token lần đầu (Login)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # ĐÂY LÀ ENDPOINT BẠN ĐANG THIẾU
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]