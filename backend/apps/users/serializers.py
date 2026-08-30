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

    def create(self, validated_data):
        user = super().create(validated_data)
        if user.role == User.Role.COMPANY and not hasattr(user, "company_profile"):
            from apps.accounts.models import CompanyProfile
            CompanyProfile.objects.create(
                user=user,
                company_name=f"{user.username}'s Company",
                status=CompanyProfile.Status.APPROVED
            )
        return user

    def update(self, instance, validated_data):
        user = super().update(instance, validated_data)
        if user.role == User.Role.COMPANY and not hasattr(user, "company_profile"):
            from apps.accounts.models import CompanyProfile
            CompanyProfile.objects.create(
                user=user,
                company_name=f"{user.username}'s Company",
                status=CompanyProfile.Status.APPROVED
            )
        return user