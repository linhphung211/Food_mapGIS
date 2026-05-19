from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Avg

from .models import Review


def recalculate_rating(food_place):
    """Tính lại avg_rating và total_reviews cho quán ăn sau mỗi thay đổi review."""
    reviews = Review.objects.filter(food_place=food_place)
    total = reviews.count()
    avg = reviews.aggregate(Avg('rating'))['rating__avg'] or 0.0

    food_place.total_reviews = total
    food_place.avg_rating = round(avg, 1)
    food_place.save(update_fields=['avg_rating', 'total_reviews'])


@receiver(post_save, sender=Review)
def update_rating_on_save(sender, instance, **kwargs):
    """Kích hoạt khi review được tạo mới hoặc cập nhật."""
    recalculate_rating(instance.food_place)


@receiver(post_delete, sender=Review)
def update_rating_on_delete(sender, instance, **kwargs):
    """Kích hoạt khi review bị xóa."""
    recalculate_rating(instance.food_place)
