from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from rest_framework_gis.fields import GeometryField

from storefront.models import FoodPlace, FoodPlaceImage, Category
from review.api.serializers import ReviewSerializer

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'icon_marker']

class FoodPlaceImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodPlaceImage
        fields = ['id', 'image']

class FoodPlaceDetailSerializer(serializers.ModelSerializer):
    # Hiển thị thông tin danh mục thay vì chỉ ID
    category_name = serializers.ReadOnlyField(source='category.name')
    # Lấy danh sách ảnh của quán
    images = FoodPlaceImageSerializer(many=True, read_only=True)
    # Lấy danh sách bình luận
    reviews = ReviewSerializer(many=True, read_only=True)
    # Cho phép nhận GeoJSON dict khi tạo/cập nhật quán
    geom = GeometryField()

    class Meta:
        model = FoodPlace
        fields = [
            'id', 'name', 'address', 'category', 'category_name', 
            'phone_number', 'opening_time', 'closing_time', 
            'min_price', 'max_price', 'description', 
            'avg_rating', 'total_reviews', 'images', 'geom', 'reviews'
        ]
        read_only_fields = ['avg_rating', 'total_reviews', 'id']

class FoodPlaceMapSerializer(GeoFeatureModelSerializer):
    """Serializer dành riêng cho hiển thị bản đồ (GeoJSON)"""
    category_name = serializers.ReadOnlyField(source='category.name')
    geom = GeometryField()
    
    class Meta:
        model = FoodPlace
        geo_field = 'geom'
        id_field = 'id'
        # Các trường trả về trong thuộc tính properties của GeoJSON (để hiển thị Popup)
        fields = ['id', 'name', 'category_name', 'avg_rating', 'total_reviews', 'address', 'min_price', 'max_price']

class FoodPlaceTopRatedSerializer(serializers.ModelSerializer):
    # Lấy tên danh mục để hiển thị (ví dụ: "Bún phở")
    category_name = serializers.ReadOnlyField(source='category.name')
    
    class Meta:
        model = FoodPlace
        # Chỉ lấy các trường cần thiết để hiển thị trên danh sách/card
        fields = [
            'id', 'name', 'address', 'category_name', 
            'avg_rating', 'total_reviews', 'min_price', 'max_price'
        ]