from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FoodPlaceViewSet

router = DefaultRouter()
router.register(r'foodplaces', FoodPlaceViewSet, basename='foodplace')

urlpatterns = [
    path('', include(router.urls)),
]
