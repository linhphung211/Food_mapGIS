from django.contrib.gis.db import models
from django.conf import settings
import zlib
import base64

class Category(models.Model):
    # Khớp với bảng category bạn định làm riêng
    name = models.CharField(max_length=100, verbose_name="Tên danh mục")
    icon_marker = models.ImageField(upload_to='icons/', null=True, blank=True)

    class Meta:
        db_table = 'category'

    def __str__(self):
        return self.name

class FoodPlace(models.Model):
    # 1. Các trường từ ảnh thuộc tính của bạn (đã sửa lỗi viết tắt)
    id = models.AutoField(primary_key=True)
    geom = models.PointField(srid=4326)
    name = models.CharField(max_length=255, verbose_name="Tên quán")
    address = models.CharField(max_length=255, verbose_name="Địa chỉ")
    phone_number = models.CharField(max_length=15, null=True, blank=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    min_price = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)
    max_price = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True)
    description = models.TextField(null=True, blank=True)

    # 2. Liên kết bảng Category (Khóa ngoại)
    category = models.ForeignKey(
        Category, 
        on_delete=models.SET_NULL, 
        null=True, 
        db_column='category_id'
    )

    # 3. Quản lý chủ sở hữu & Thống kê
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='my_places'
    )
    avg_rating = models.FloatField(default=0.0)
    total_reviews = models.IntegerField(default=0)

    class Meta:
        db_table = 'thongtinquanan'

class FoodPlaceImage(models.Model):
    # Bảng ảnh riêng để một quán có nhiều ảnh
    food_place = models.ForeignKey(
        FoodPlace, 
        on_delete=models.CASCADE, 
        related_name='images'
    )
    image = models.ImageField(upload_to='food_places/gallery/')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'food_place_image'