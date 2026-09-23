from apps.accounts.models import User
from .models import Project,ProjectProfile,Framework,TestRun
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from django.core.cache import cache


class ProjectUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id","username"]

class ProjectSerializer(serializers.ModelSerializer):
    owner = ProjectUserSerializer(read_only=True)
    assigned_teams = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    is_daemon_active = serializers.SerializerMethodField()
    is_stream_active = serializers.SerializerMethodField()
    containers_count = serializers.SerializerMethodField()

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
            "connection_code",
            "assigned_teams",
            "is_daemon_active",
            "is_stream_active",
            "containers_count",
        ]

    def get_is_daemon_active(self, obj):
        code = (obj.connection_code or "").upper()
        return bool(code and (cache.get(f"core_daemon_active_{code}") or cache.get(f"core_daemon_active_{code.lower()}")))

    def get_is_stream_active(self, obj):
        code = (obj.connection_code or "").upper()
        return bool(code and (cache.get(f"core_active_stream_{code}") or cache.get(f"core_active_stream_{code.lower()}")))

    def get_containers_count(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.docker_containers:
            return len(profile.docker_containers)
        return 0

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
            "analysis_data",
            "docker_containers",
            "detected_at",
        ]

class SingleProjectSerializer(serializers.ModelSerializer):

    owner = ProjectUserSerializer(read_only=True)
    profile = ProjectProfileSerializer(read_only=True)
    assigned_teams = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    is_daemon_active = serializers.SerializerMethodField()
    is_stream_active = serializers.SerializerMethodField()
    containers_count = serializers.SerializerMethodField()

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
            "assigned_teams",
            "is_daemon_active",
            "is_stream_active",
            "containers_count",
        ]

    def get_is_daemon_active(self, obj):
        code = (obj.connection_code or "").upper()
        return bool(code and (cache.get(f"core_daemon_active_{code}") or cache.get(f"core_daemon_active_{code.lower()}")))

    def get_is_stream_active(self, obj):
        code = (obj.connection_code or "").upper()
        return bool(code and (cache.get(f"core_active_stream_{code}") or cache.get(f"core_active_stream_{code.lower()}")))

    def get_containers_count(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.docker_containers:
            return len(profile.docker_containers)
        return 0


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


from .models import FaultInjection
import re

SUPPORTED_FAULTS = {
    "container_stop",
    "container_restart",
    "network_delay",
    "network_loss",
    "cpu_stress",
    "memory_stress",
}


class FaultInjectionCreateSerializer(serializers.ModelSerializer):
    parameters = serializers.JSONField(default=dict, required=False)

    class Meta:
        model = FaultInjection
        fields = ["fault_type", "target", "parameters"]

    def validate_fault_type(self, value):
        if value not in SUPPORTED_FAULTS:
            raise serializers.ValidationError(f"Unsupported fault type: '{value}'. Must be one of {sorted(list(SUPPORTED_FAULTS))}")
        return value

    def validate_target(self, value):
        target = value.strip()
        if not target:
            raise serializers.ValidationError("Target cannot be empty.")
        if not re.match(r"^[a-zA-Z0-9_\.\-]+$", target):
            raise serializers.ValidationError("Target must be a valid container or service identifier (alphanumeric, dashes, underscores, dots).")
        return target

    def validate(self, attrs):
        fault_type = attrs.get("fault_type")
        params = attrs.get("parameters") or {}
        if not isinstance(params, dict):
            raise serializers.ValidationError({"parameters": "Parameters must be a JSON object / dictionary."})

        # Validate target against project registered containers if profile containers are set
        target = attrs.get("target")
        project = self.context.get("project")
        if target and project and hasattr(project, "profile") and project.profile.docker_containers:
            registered_names = set()
            for c in project.profile.docker_containers:
                if isinstance(c, dict):
                    for k in ("name", "service", "id"):
                        val = c.get(k)
                        if val:
                            registered_names.add(str(val).lower())
                elif isinstance(c, str):
                    registered_names.add(c.lower())

            clean_target = str(target).lower().strip()
            if registered_names and clean_target not in registered_names and not any(clean_target in r or r in clean_target for r in registered_names):
                raise serializers.ValidationError({"target": f"Target container '{target}' is not registered under project '{project.connection_code}'."})

        # Validate duration if present
        if "duration" in params:
            try:
                duration = int(params["duration"])
                if duration <= 0 or duration > 300:
                    raise serializers.ValidationError({"parameters": "Duration must be between 1 and 300 seconds."})
                params["duration"] = duration
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "Duration must be an integer."})

        # Validate interface format if present
        if "interface" in params:
            interface_val = str(params["interface"]).strip()
            if not re.match(r"^[a-zA-Z0-9_\-]+$", interface_val):
                raise serializers.ValidationError({"parameters": f"Invalid network interface '{interface_val}'."})
            params["interface"] = interface_val

        # Fault-specific validation
        if fault_type == "network_delay":
            latency = params.get("latency_ms", 500)
            try:
                latency = int(latency)
                if latency < 1 or latency > 5000:
                    raise serializers.ValidationError({"parameters": "latency_ms must be between 1 and 5000 milliseconds."})
                params["latency_ms"] = latency
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "latency_ms must be an integer."})

            if "jitter_ms" in params:
                try:
                    jitter = int(params["jitter_ms"])
                    if jitter < 0 or jitter > 1000:
                        raise serializers.ValidationError({"parameters": "jitter_ms must be between 0 and 1000 milliseconds."})
                    params["jitter_ms"] = jitter
                except (ValueError, TypeError):
                    raise serializers.ValidationError({"parameters": "jitter_ms must be an integer."})

        elif fault_type == "network_loss":
            loss = params.get("loss_percent", 20)
            try:
                loss = float(loss)
                if loss <= 0 or loss > 100:
                    raise serializers.ValidationError({"parameters": "loss_percent must be between 0.1 and 100."})
                params["loss_percent"] = loss
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "loss_percent must be a numeric value."})

        elif fault_type == "cpu_stress":
            workers = params.get("workers", 2)
            try:
                workers = int(workers)
                if workers < 1 or workers > 16:
                    raise serializers.ValidationError({"parameters": "workers must be between 1 and 16."})
                params["workers"] = workers
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "workers must be an integer."})

        elif fault_type == "memory_stress":
            memory_mb = params.get("memory_mb", 256)
            try:
                memory_mb = int(memory_mb)
                if memory_mb < 16 or memory_mb > 4096:
                    raise serializers.ValidationError({"parameters": "memory_mb must be between 16 and 4096 MB."})
                params["memory_mb"] = memory_mb
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "memory_mb must be an integer."})

        elif fault_type in ("container_stop", "container_restart"):
            if "timeout" in params:
                try:
                    timeout = int(params["timeout"])
                    if timeout < 1 or timeout > 60:
                        raise serializers.ValidationError({"parameters": "timeout must be between 1 and 60 seconds."})
                    params["timeout"] = timeout
                except (ValueError, TypeError):
                    raise serializers.ValidationError({"parameters": "timeout must be an integer."})

        attrs["parameters"] = params
        return attrs


from .models import FaultInjection, FaultInjectionLog


class FaultInjectionLogSerializer(serializers.ModelSerializer):
    fault_id = serializers.ReadOnlyField(source="fault.id")
    injection_id = serializers.ReadOnlyField(source="fault.id")

    class Meta:
        model = FaultInjectionLog
        fields = ["id", "fault_id", "injection_id", "timestamp", "level", "message"]
        read_only_fields = ["id", "fault_id", "injection_id", "timestamp"]


class FaultInjectionSerializer(serializers.ModelSerializer):
    injection_id = serializers.ReadOnlyField(source="id")
    created_at = serializers.ReadOnlyField(source="requested_at")
    project_id = serializers.ReadOnlyField(source="project.id")
    project_title = serializers.ReadOnlyField(source="project.title")
    project_code = serializers.ReadOnlyField(source="project.connection_code")
    requested_by = ProjectUserSerializer(read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    logs_count = serializers.SerializerMethodField()

    class Meta:
        model = FaultInjection
        fields = [
            "id",
            "injection_id",
            "project",
            "project_id",
            "project_title",
            "project_code",
            "requested_by",
            "fault_type",
            "target",
            "parameters",
            "status",
            "created_at",
            "requested_at",
            "started_at",
            "completed_at",
            "duration_seconds",
            "logs_count",
            "result",
            "error_message",
        ]
        read_only_fields = [
            "id",
            "injection_id",
            "project",
            "project_id",
            "project_title",
            "project_code",
            "requested_by",
            "status",
            "created_at",
            "requested_at",
            "started_at",
            "completed_at",
            "duration_seconds",
            "logs_count",
            "result",
            "error_message",
        ]

    def get_duration_seconds(self, obj):
        if obj.started_at and obj.completed_at:
            delta = (obj.completed_at - obj.started_at).total_seconds()
            return round(delta, 2)
        if "duration" in (obj.parameters or {}):
            return obj.parameters["duration"]
        return None

    def get_logs_count(self, obj):
        if hasattr(obj, "logs"):
            return obj.logs.count()
        return 0


class FaultInjectionReportSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        FaultInjection.Status.COMPLETED,
        FaultInjection.Status.FAILED,
        FaultInjection.Status.CANCELLED,
    ])
    result = serializers.JSONField(default=dict, required=False)
    error_message = serializers.CharField(required=False, allow_blank=True, default="")