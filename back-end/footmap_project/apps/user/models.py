import uuid
from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from phonenumber_field.modelfields import PhoneNumberField
from django.utils import timezone
from datetime import timedelta

class User(AbstractUser):
    # Định nghĩa Role
    USER = 'user'
    MERCHANT = 'merchant'
    ROLE_CHOICES = [
        (USER, 'Người dùng'),
        (MERCHANT, 'Người bán hàng'),
    ]

    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=USER)
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)
    
    is_email_verified = models.BooleanField(default=False)
    

    class Meta:
        db_table = 'user'

class UserSession(models.Model):
    session_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sessions')
    refresh_token = models.CharField(max_length=512, unique=True, db_index=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    is_revoked = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expired_at = models.DateTimeField()

    class Meta:
        db_table = 'user_session'
        ordering = ['-created_at']

# Trong Model UserSession
    def refresh_expiry(self, new_token=None):
        self.expired_at = timezone.now() + timedelta(days=7)
        self.is_revoked = False
        if new_token:
            self.refresh_token = new_token
        self.save()

    @property
    def is_valid(self):
        return not self.is_revoked and self.expired_at > timezone.now()