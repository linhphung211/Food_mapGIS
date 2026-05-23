from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReviewViewSet, ReviewReplyViewSet

# Router chính cho /reviews/ và /reviews/{pk}/
router = DefaultRouter()
router.register(r'', ReviewViewSet, basename='review')

# Routes thủ công cho reply (tránh cài thêm drf-nested-routers):
# POST   /reviews/{review_pk}/reply/
# PATCH  /reviews/{review_pk}/reply/
# DELETE /reviews/{review_pk}/reply/
reply_viewset = ReviewReplyViewSet.as_view({
    'post':   'create_reply',
    'patch':  'update_reply',
    'delete': 'delete_reply',
})

urlpatterns = [
    path('', include(router.urls)),
    path('<int:review_pk>/reply/', reply_viewset, name='review-reply'),
]
