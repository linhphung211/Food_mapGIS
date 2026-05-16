import os
from celery import Celery

# Thiết lập Django settings mặc định cho Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('footmap_project')

# Sử dụng chuỗi để worker không phải serialize object khi dùng Windows
app.config_from_object('django.conf:settings', namespace='CELERY')

# Tự động tìm các task trong tất cả các app đã đăng ký (tasks.py)
app.autodiscover_tasks()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
