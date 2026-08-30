from apps.accounts.models import User
from .models import Project,ProjectProfile,Framework,TestRun
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


class TestRunSerializer(serializers.ModelSerializer):
    project_id = serializers.ReadOnlyField(source="project.id")
    project_title = serializers.ReadOnlyField(source="project.title")
    executor_id = serializers.ReadOnlyField(source="executor.id")
    executor_username = serializers.ReadOnlyField(source="executor.username")
    executor_email = serializers.ReadOnlyField(source="executor.email")
    executor_first_name = serializers.ReadOnlyField(source="executor.first_name")
    executor_last_name = serializers.ReadOnlyField(source="executor.last_name")
    team_id = serializers.ReadOnlyField(source="team.id", default=None)
    team_name = serializers.ReadOnlyField(source="team.name", default=None)

    class Meta:
        model = TestRun
        fields = [
            "id",
            "project",
            "project_id",
            "project_title",
            "executor_id",
            "executor_username",
            "executor_email",
            "executor_first_name",
            "executor_last_name",
            "team_id",
            "team_name",
            "suite_name",
            "status",
            "command",
            "total_tests",
            "passed_tests",
            "failed_tests",
            "skipped_tests",
            "duration_ms",
            "logs",
            "created_at",
        ]
        read_only_fields = ["executor", "created_at"]