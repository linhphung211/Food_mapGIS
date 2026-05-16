from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from storefront.models import FoodPlace, Category
from .serializers import FoodPlaceDetailSerializer
from user.permissions import IsMerchant # Class IsMerchant chúng ta đã viết

class FoodPlaceViewSet(viewsets.ModelViewSet):
    serializer_class = FoodPlaceDetailSerializer

    def get_queryset(self):
        user = self.request.user
        # Nếu là Merchant đăng nhập, chỉ hiện quán của họ để quản lý
        if self.action in ['update', 'partial_update', 'destroy'] or \
           (self.action == 'list' and self.request.query_params.get('manage') == 'true'):
            return FoodPlace.objects.filter(owner=user)
        
        # Mặc định (cho khách xem bản đồ) trả về tất cả quán
        return FoodPlace.objects.all()

    # def get_serializer_class(self):
    #     # Nếu yêu cầu từ bản đồ, dùng MapSerializer (GeoJSON)
    #     if self.request.query_params.get('format') == 'geojson':
    #         return FoodPlaceMapSerializer
    #     return FoodPlaceDetailSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            permission_classes = [permissions.IsAuthenticatedOrReadOnly]
        else:
            permission_classes = [IsMerchant]
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        # Tự động gán Merchant đang đăng nhập làm chủ sở hữu
        serializer.save(owner=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """
        Ghi đè retrieve để khi xem chi tiết 1 quán, 
        nếu là chủ sở hữu thì trả về thêm dữ liệu bình luận chi tiết.
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        
        # Kiểm tra nếu người xem là chủ quán, có thể đính kèm logic đặc biệt ở đây
        if instance.owner == request.user:
            data['is_owner'] = True
            
        return Response(data)