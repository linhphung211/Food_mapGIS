from django.apps import AppConfig


class ReviewConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'review'

    def ready(self):
        import review.signals  # noqa: F401 - kết nối signals khi app khởi động
