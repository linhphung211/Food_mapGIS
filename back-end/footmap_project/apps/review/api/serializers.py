from rest_framework import serializers
from review.models import Review, ReviewReply


class ReviewReplySerializer(serializers.ModelSerializer):
    """
    Serializer cho phản hồi của chủ quán.
    Bảng riêng `review_reply` – tách biệt hoàn toàn với bảng `review`.
    """
    merchant_username = serializers.CharField(source='merchant.username', read_only=True)

    class Meta:
        model = ReviewReply
        fields = ['id', 'content', 'merchant_username', 'created_at', 'updated_at']
        read_only_fields = ['id', 'merchant_username', 'created_at', 'updated_at']


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    # Nest reply (từ bảng review_reply) vào response – read_only, None nếu chưa có reply
    reply = ReviewReplySerializer(read_only=True, default=None)

    class Meta:
        model = Review
        fields = [
            'id', 'user', 'username', 'food_place',
            'rating', 'comment', 'created_at', 'updated_at',
            'reply',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
