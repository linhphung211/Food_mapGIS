from rest_framework import serializers
from django.core.validators import RegexValidator, EmailValidator
from django.contrib.auth.password_validation import validate_password
from phonenumber_field.serializerfields import PhoneNumberField
from ..models import User

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    
    # Username: Bắt đầu bằng chữ, bắt đầu có ít nhất 1 số hoặc ký tự đặc biệt
    username = serializers.CharField(validators=[
        RegexValidator(
            regex=r'^[a-zA-Z](?=.*[0-9!@#$%^&*])',
            message="Username bắt đầu bằng chữ, chứa ít nhất 1 số hoặc ký tự đặc biệt."
        )
    ])

    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, default=User.USER)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=False, validators=[EmailValidator(message="Email không hợp lệ.")])

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'birthday', 'role')

    def validate_email(self, value):
        if value and User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email này đã được sử dụng.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'avatar', 'birthday', 'role')
        read_only_fields = ['id', 'username', 'role'] # Không cho sửa ID và Username

    def validate_email(self, value):
        user = self.context['request'].user
        if value and User.objects.exclude(pk=user.pk).filter(email=value).exists():
            raise serializers.ValidationError("Email này đã được sử dụng bởi một tài khoản khác.")
        return value