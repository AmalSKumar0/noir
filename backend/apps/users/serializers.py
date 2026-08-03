from rest_framework import serializers
from apps.accounts.models import User,SocialAuth

class SocialAuthSerializer(serializers.ModelSerializer):
    class Meta:
        model = SocialAuth
        fields = ["provider"]

class UserSerializer(serializers.ModelSerializer):
    social = SocialAuthSerializer(
        source="social_accounts",
        many=True,
        read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "social",
            "is_active",
            "date_joined",
        ]