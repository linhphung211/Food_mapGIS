from django.db import models
from django.conf import settings
from storefront.models import FoodPlace
from django.core.validators import MinValueValidator, MaxValueValidator

class Review(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='reviews'
    )
    food_place = models.ForeignKey(
        FoodPlace, 
        on_delete=models.CASCADE, 
        related_name='reviews'
    )
    rating = models.IntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'review'
        unique_together = ('user', 'food_place')
        ordering = ['-created_at']

    def __str__(self):
        return f'Review by {self.user} for {self.food_place.name}'


class ReviewReply(models.Model):
    """
    Bảng riêng lưu phản hồi của chủ quán cho từng bình luận.
    Mỗi bình luận (review) chỉ được phản hồi đúng một lần (OneToOne).
    Hoàn toàn tách biệt với bảng review – chỉ liên kết qua khóa ngoại.
    """
    review = models.OneToOneField(
        Review,
        on_delete=models.CASCADE,
        related_name='reply'
    )
    merchant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='review_replies'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'review_reply'
        ordering = ['created_at']

    def __str__(self):
        return f'Reply by {self.merchant} on review #{self.review_id}'
