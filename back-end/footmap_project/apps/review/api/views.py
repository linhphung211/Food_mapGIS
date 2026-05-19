from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from review.models import Review
from review.api.serializers import ReviewSerializer
from user.permissions import IsCustomer, IsMerchant
from storefront.models import FoodPlace

class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Chỉ khách hàng (user) mới có thể thêm, sửa, xoá bình luận của mình
            permission_classes = [IsCustomer]
        else:
            # list, retrieve: Yêu cầu đăng nhập, logic filter sẽ được xử lý ở get_queryset
            permission_classes = [permissions.IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        user = self.request.user
        
        if user.role == 'merchant':
            # Chủ quán ăn chỉ có thể xem toàn bộ các bình luận trong toàn bộ các quán của mình
            return Review.objects.filter(food_place__owner=user)
            
        elif user.role == 'user':
            # Nếu đang thực hiện thao tác sửa/xóa, chỉ cho phép thao tác trên bình luận của chính mình
            if self.action in ['update', 'partial_update', 'destroy']:
                return Review.objects.filter(user=user)
                
            # Khách hàng có thể xem bình luận của người khác trong quán đó
            food_place_id = self.request.query_params.get('food_place_id')
            if food_place_id:
                return Review.objects.filter(food_place_id=food_place_id)
                
            # Hoặc có thể xem danh sách lịch sử bình luận của mình
            return Review.objects.filter(user=user)
            
        return Review.objects.none()

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
    def create(self, request, *args, **kwargs):
        food_place_id = request.data.get('food_place')
        if not food_place_id:
            return Response({"error": "food_place is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Kiểm tra quán ăn có tồn tại không
        if not FoodPlace.objects.filter(id=food_place_id).exists():
             return Response({"error": "Food place does not exist."}, status=status.HTTP_404_NOT_FOUND)

        # Nếu khách hàng thêm 1 bình luận khác vào chính quán ăn đã bình luận, ghi đè
        existing_review = Review.objects.filter(user=request.user, food_place_id=food_place_id).first()
        if existing_review:
            serializer = self.get_serializer(existing_review, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        return super().create(request, *args, **kwargs)
