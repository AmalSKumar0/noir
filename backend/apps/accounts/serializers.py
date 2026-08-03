from apps.accounts.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "email", "password"]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
    

class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop(self.username_field, None)

    def validate(self, attrs):
        email = attrs.get("email")
        
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise AuthenticationFailed("No active account found with the given credentials", code="authorization")
            
        attrs[self.username_field] = user.username

        data = super().validate(attrs)
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": "admin" if user.is_superuser else user.role,
        }
        return data