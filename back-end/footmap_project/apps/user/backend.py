from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from .models import User

class MultiFieldModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            return None
            
        try:
            # Tìm kiếm trên cả 3 trường
            user = User.objects.get(
                Q(username__iexact=username)
            )
        except User.DoesNotExist:
            return None

        # Kiểm tra mật khẩu và trạng thái active
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None