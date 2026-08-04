from apps.accounts.models import User
from .models import Project,ProjectProfile,Framework
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed


class ProjectUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id","username"]

class ProjectSerializer(serializers.ModelSerializer):
    owner = ProjectUserSerializer(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "owner",
            "title",
            "description",
            "architecture",
            "visibility",
            "analysis_mode",
            "status",
            "created_at",
            "updated_at",
            "connection_code"
        ]

class FrameworkSerializer(serializers.ModelSerializer):
    class Meta:
        model = Framework
        fields = [
            "id",
            "name",
            "language",
            "supported",
        ]

class ProjectProfileSerializer(serializers.ModelSerializer):
    framework = FrameworkSerializer(read_only=True)

    class Meta:
        model = ProjectProfile
        fields = [
            "framework",
            "runtime_version",
            "package_manager",
            "operating_system",
            "detected_at",
        ]

class SingleProjectSerializer(serializers.ModelSerializer):

    owner = ProjectUserSerializer(read_only=True)
    profile = ProjectProfileSerializer(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "connection_code",
            "owner",
            "title",
            "description",
            "architecture",
            "visibility",
            "analysis_mode",
            "status",
            "profile",
            "created_at",
            "updated_at",
        ]