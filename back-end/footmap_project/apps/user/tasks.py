from celery import shared_task
from django.utils import timezone
from django.contrib.auth import get_user_model
from user.models import UserSession
import logging
from datetime import timedelta

User = get_user_model()

@shared_task
def cleanup_inactive_users():
    # Xác định mốc 30 ngày trước
    cutoff_date = timezone.now() - timedelta(days=30)
    
    # Tìm các user không hoạt động (last_login < 30 ngày)
    # Loại trừ Admin và nhân viên để tránh xóa nhầm tài khoản quản trị
    inactive_users = User.objects.filter(
        last_login__lt=cutoff_date,
        is_staff=False,
        is_superuser=False
    )
    
    count = inactive_users.count()
    # Ở đây mình chọn cách xóa mềm (khóa tài khoản) cho an toàn
    inactive_users.update(is_active=False) 
    
    return f"Đã khóa {count} tài khoản không hoạt động trong 30 ngày."

logger = logging.getLogger(__name__)

@shared_task
def cleanup_expired_sessions():
    """
    Xóa tất cả các phiên đăng nhập (UserSession) đã hết hạn
    """
    now = timezone.now()
    
    # Tìm các session có expired_at nhỏ hơn thời điểm hiện tại
    expired_sessions = UserSession.objects.filter(expired_at__lt=now)
    
    count = expired_sessions.count()
    if count > 0:
        expired_sessions.delete()
        logger.info(f"--- [CLEANUP] Đã xóa {count} session hết hạn thành công. ---")
    else:
        logger.info("--- [CLEANUP] Không có session nào hết hạn để xóa. ---")
        
    return f"Deleted {count} expired sessions."


