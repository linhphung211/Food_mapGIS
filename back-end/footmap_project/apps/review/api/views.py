from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiTypes
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from review.models import Review, ReviewReply
from review.api.serializers import ReviewSerializer, ReviewReplySerializer
from user.permissions import IsCustomer, IsMerchant
from storefront.models import FoodPlace


# ─────────────────────────────────────────────────────────────────────────────
# ReviewViewSet – quản lý bình luận của khách hàng (bảng `review`)
# ─────────────────────────────────────────────────────────────────────────────
@extend_schema_view(
    list=extend_schema(
        tags=['Reviews'],
        summary="Lấy danh sách đánh giá",
        parameters=[
            OpenApiParameter(name='food_place_id', type=OpenApiTypes.INT, description="Lọc đánh giá theo ID của quán ăn")
        ]
    ),
    retrieve=extend_schema(tags=['Reviews'], summary="Xem chi tiết đánh giá"),
    create=extend_schema(tags=['Reviews'], summary="Viết đánh giá cho quán ăn"),
    update=extend_schema(tags=['Reviews'], summary="Cập nhật đánh giá"),
    partial_update=extend_schema(tags=['Reviews'], summary="Cập nhật 1 phần đánh giá"),
    destroy=extend_schema(tags=['Reviews'], summary="Xoá đánh giá"),
)
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
            return Review.objects.filter(food_place__owner=user).select_related('reply', 'reply__merchant')

        elif user.role == 'user':
            # Nếu đang thực hiện thao tác sửa/xóa, chỉ cho phép thao tác trên bình luận của chính mình
            if self.action in ['update', 'partial_update', 'destroy']:
                return Review.objects.filter(user=user)

            # Khách hàng có thể xem bình luận của người khác trong quán đó
            food_place_id = self.request.query_params.get('food_place_id')
            if food_place_id:
                return Review.objects.filter(food_place_id=food_place_id).select_related('reply', 'reply__merchant')

            # Hoặc có thể xem danh sách lịch sử bình luận của mình
            return Review.objects.filter(user=user).select_related('reply', 'reply__merchant')

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


# ─────────────────────────────────────────────────────────────────────────────
# ReviewReplyViewSet – quản lý phản hồi của chủ quán (bảng `review_reply`)
# Hoàn toàn tách biệt với bảng `review`.
# Routes: /reviews/{review_pk}/reply/
# ─────────────────────────────────────────────────────────────────────────────
class ReviewReplyViewSet(viewsets.GenericViewSet):
    """
    ViewSet cho phản hồi của chủ quán (bảng review_reply).
    Chỉ merchant của quán sở hữu review mới được tạo/sửa/xóa reply.
    Khách hàng phải bình luận trước thì merchant mới reply được.
    """
    serializer_class = ReviewReplySerializer
    permission_classes = [IsMerchant]

    def _get_review_for_merchant(self, review_pk, user):
        """
        Lấy review và xác nhận nó thuộc quán của merchant hiện tại.
        Raise 404 nếu review không tồn tại hoặc không thuộc quán của merchant.
        """
        try:
            review = Review.objects.select_related('food_place__owner', 'reply').get(pk=review_pk)
        except Review.DoesNotExist:
            return None, Response(
                {"error": "Bình luận không tồn tại."},
                status=status.HTTP_404_NOT_FOUND
            )

        if review.food_place.owner != user:
            return None, Response(
                {"error": "Bạn không có quyền thao tác với bình luận này."},
                status=status.HTTP_403_FORBIDDEN
            )

        return review, None

    def create_reply(self, request, review_pk=None):
        """POST /reviews/{review_pk}/reply/ – Tạo phản hồi mới"""
        review_pk = self.kwargs.get('review_pk')
        review, err = self._get_review_for_merchant(review_pk, request.user)
        if err:
            return err

        # Kiểm tra đã có reply chưa (OneToOne – mỗi review chỉ 1 reply)
        try:
            existing_reply = review.reply
            if existing_reply:
                return Response(
                    {"error": "Bình luận này đã được trả lời. Hãy dùng chức năng sửa để cập nhật."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except ReviewReply.DoesNotExist:
            pass

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(review=review, merchant=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update_reply(self, request, review_pk=None):
        """PATCH /reviews/{review_pk}/reply/ – Sửa phản hồi"""
        review_pk = self.kwargs.get('review_pk')
        review, err = self._get_review_for_merchant(review_pk, request.user)
        if err:
            return err

        try:
            reply = review.reply
        except ReviewReply.DoesNotExist:
            return Response(
                {"error": "Chưa có phản hồi nào cho bình luận này."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Đảm bảo chỉ merchant tạo reply mới được sửa
        if reply.merchant != request.user:
            return Response(
                {"error": "Bạn không có quyền sửa phản hồi này."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = self.get_serializer(reply, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete_reply(self, request, review_pk=None):
        """DELETE /reviews/{review_pk}/reply/ – Xóa phản hồi"""
        review_pk = self.kwargs.get('review_pk')
        review, err = self._get_review_for_merchant(review_pk, request.user)
        if err:
            return err

        try:
            reply = review.reply
        except ReviewReply.DoesNotExist:
            return Response(
                {"error": "Chưa có phản hồi nào cho bình luận này."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Đảm bảo chỉ merchant tạo reply mới được xóa
        if reply.merchant != request.user:
            return Response(
                {"error": "Bạn không có quyền xóa phản hồi này."},
                status=status.HTTP_403_FORBIDDEN
            )

        reply.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
