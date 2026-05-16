from rest_framework import permissions
from .models import User

class IsMerchant(permissions.BasePermission):
    """Quyền dành riêng cho Người bán hàng"""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == User.MERCHANT
        )

class IsCustomer(permissions.BasePermission):
    """Quyền dành riêng cho Người dùng (Khách mua)"""
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == User.USER
        )