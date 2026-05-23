from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Prefetch
from storefront.models import FoodPlace, Category
from review.models import Review
from .serializers import (
    CategorySerializer,
    FoodPlaceDetailSerializer,
    FoodPlaceMapSerializer,
    FoodPlaceTopRatedSerializer,
)
from user.permissions import IsMerchant

@extend_schema_view(
    list=extend_schema(tags=['Categories'], summary="Lấy danh sách danh mục"),
    retrieve=extend_schema(tags=['Categories'], summary="Lấy chi tiết danh mục")
)
class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API trả về danh sách danh mục quán ăn.
    GET /api/storefronts/categories/        – list tất cả
    GET /api/storefronts/categories/{id}/   – chi tiết 1 danh mục
    Không yêu cầu xác thực (AllowAny) để FE dropdown luôn hiển thị được.
    """
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


@extend_schema_view(
    list=extend_schema(
        tags=['Food Places'], 
        summary="Lấy danh sách quán ăn",
        parameters=[
            OpenApiParameter(name='manage', type=OpenApiTypes.BOOL, description="Truyền true nếu muốn xem danh sách quán của merchant đang đăng nhập"),
            OpenApiParameter(name='type', type=OpenApiTypes.STR, enum=['geojson'], description="Truyền geojson để lấy data dạng bản đồ"),
            OpenApiParameter(name='category', type=OpenApiTypes.STR, description="Lọc quán ăn theo tên danh mục (vd: 'Nhà Hàng')")
        ]
    ),
    retrieve=extend_schema(tags=['Food Places'], summary="Xem chi tiết quán ăn"),
    create=extend_schema(tags=['Food Places'], summary="Tạo mới quán ăn (Chỉ Merchant)"),
    update=extend_schema(tags=['Food Places'], summary="Cập nhật thông tin quán ăn"),
    partial_update=extend_schema(tags=['Food Places'], summary="Cập nhật 1 phần thông tin quán ăn"),
    destroy=extend_schema(tags=['Food Places'], summary="Xoá quán ăn")
)
class FoodPlaceViewSet(viewsets.ModelViewSet):
    serializer_class = FoodPlaceDetailSerializer

    def get_queryset(self):
        user = self.request.user
        
        # 1. Tối ưu N+1: Luôn lấy sẵn danh mục vì cả 2 Serializer đều cần category_name
        qs = FoodPlace.objects.select_related('category')
        
        # 2. Tối ưu N+1: Chỉ tải hình ảnh và bình luận nếu KHÔNG phải luồng GeoJSON (Map)
        if self.request.query_params.get('type') != 'geojson':
            qs = qs.prefetch_related(
                'images',
                # Tối ưu sâu cho phần bình luận: lấy luôn user bình luận và reply của merchant
                Prefetch('reviews', queryset=Review.objects.select_related('user', 'reply__merchant'))
            )

        # Nếu là Merchant thao tác hoặc yêu cầu manage, chỉ trả về quán của họ
        if self.action in ['update', 'partial_update', 'destroy'] or \
           (self.action == 'list' and self.request.query_params.get('manage') == 'true'):
            return qs.filter(owner=user)
            
        # Lọc theo danh mục nếu có query parameter 'category'
        category_name = self.request.query_params.get('category')
        if category_name:
            qs = qs.filter(category__name__iexact=category_name)
        
        # Mặc định trả về query đã tối ưu
        return qs

    def get_serializer_class(self):
        # Nếu yêu cầu từ bản đồ, dùng MapSerializer (GeoJSON)
        if self.request.query_params.get('type') == 'geojson':
            return FoodPlaceMapSerializer
        return FoodPlaceDetailSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'top_rated']:
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
        if request.user.is_authenticated and instance.owner_id == request.user.id:
            data['is_owner'] = True
            
        return Response(data)

    @extend_schema(tags=['Food Places'], summary="Danh sách Top 10 quán ăn đánh giá cao")
    @action(detail=False, methods=['get'])
    def top_rated(self, request):
        """
        API trả về danh sách top 10 quán ăn có đánh giá cao nhất.
        (Được lọc theo category nhờ sử dụng get_queryset)
        """
        qs = self.get_queryset().filter(total_reviews__gt=0).order_by('-avg_rating', '-total_reviews')[:10]
        serializer = FoodPlaceTopRatedSerializer(qs, many=True)
        return Response(serializer.data)