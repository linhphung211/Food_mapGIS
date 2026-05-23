from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FoodPlaceViewSet, CategoryViewSet

router = DefaultRouter()
router.register(r'foodplaces', FoodPlaceViewSet, basename='foodplace')
router.register(r'categories', CategoryViewSet, basename='category')

urlpatterns = [
    path('', include(router.urls)),
]
