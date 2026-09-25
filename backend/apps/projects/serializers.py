from datetime import datetime
from django.utils import timezone
from apps.accounts.models import User
from .models import Project,ProjectProfile,Framework,TestRun
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from django.core.cache import cache


def _is_daemon_active_for_code(code: str) -> bool:
    if not code:
        return False
    c_upper = code.upper()
    c_lower = code.lower()
    return bool(cache.get(f"core_daemon_active_{c_upper}") or cache.get(f"core_daemon_active_{c_lower}"))


class ProjectUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id","username"]

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

class ProjectSerializer(serializers.ModelSerializer):
    owner = ProjectUserSerializer(read_only=True)
    profile = ProjectProfileSerializer(read_only=True)
    assigned_teams = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")
    is_daemon_active = serializers.SerializerMethodField()
    is_stream_active = serializers.SerializerMethodField()
    containers_count = serializers.SerializerMethodField()
    tests_count = serializers.SerializerMethodField()
    experiments_count = serializers.SerializerMethodField()

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
            "profile",
            "created_at",
            "updated_at",
            "connection_code",
            "assigned_teams",
            "is_daemon_active",
            "is_stream_active",
            "containers_count",
            "tests_count",
            "experiments_count",
        ]
        extra_kwargs = {
            "title": {
                "required": True,
                "allow_blank": False,
                "error_messages": {
                    "required": "Project title is required.",
                    "blank": "Project title cannot be blank.",
                },
            },
            "description": {
                "required": True,
                "allow_blank": False,
                "error_messages": {
                    "required": "Project description is required.",
                    "blank": "Project description cannot be blank.",
                },
            },
            "architecture": {
                "required": True,
                "allow_blank": False,
                "error_messages": {
                    "required": "Architecture is required.",
                    "blank": "Architecture cannot be blank.",
                },
            },
            "visibility": {
                "required": True,
                "allow_blank": False,
                "error_messages": {
                    "required": "Visibility is required.",
                    "blank": "Visibility cannot be blank.",
                },
            },
            "analysis_mode": {
                "required": True,
                "allow_blank": False,
                "error_messages": {
                    "required": "Analysis mode is required.",
                    "blank": "Analysis mode cannot be blank.",
                },
            },
        }

    def validate_title(self, value):
        val = str(value or "").strip()
        if not val:
            raise serializers.ValidationError("Project title is required and cannot be blank.")
        if len(val) > 100:
            raise serializers.ValidationError("Project title cannot exceed 100 characters.")
        return val

    def validate_description(self, value):
        val = str(value or "").strip()
        if not val:
            raise serializers.ValidationError("Project description is required and cannot be blank.")
        return val

    def validate_architecture(self, value):
        val = str(value or "").strip().lower()
        valid_choices = [c[0] for c in Project.DeploymentType.choices]
        if not val or val not in valid_choices:
            raise serializers.ValidationError(f"Architecture is required. Valid choices: {', '.join(valid_choices)}.")
        return val

    def validate_visibility(self, value):
        val = str(value or "").strip().lower()
        valid_choices = [c[0] for c in Project.Visibility.choices]
        if not val or val not in valid_choices:
            raise serializers.ValidationError(f"Visibility is required. Valid choices: {', '.join(valid_choices)}.")
        return val

    def validate_analysis_mode(self, value):
        val = str(value or "").strip().lower()
        valid_choices = [c[0] for c in Project.AnalysisMode.choices]
        if not val or val not in valid_choices:
            raise serializers.ValidationError(f"Analysis mode is required. Valid choices: {', '.join(valid_choices)}.")
        return val

    def get_is_daemon_active(self, obj):
        return _is_daemon_active_for_code(obj.connection_code)

    def get_is_stream_active(self, obj):
        code = (obj.connection_code or "").upper()
        return bool(code and (cache.get(f"core_active_stream_{code}") or cache.get(f"core_active_stream_{code.lower()}")))

    def get_containers_count(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.docker_containers:
            return len(profile.docker_containers)
        return 0

    def get_tests_count(self, obj):
        return obj.test_runs.count()

    def get_experiments_count(self, obj):
        return obj.fault_injections.count()

class SingleProjectSerializer(ProjectSerializer):
    pass

    class Meta(ProjectSerializer.Meta):
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
    hypothesis = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    expected_behavior = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    rto_target_seconds = serializers.FloatField(required=False, default=5.0)

    class Meta:
        model = FaultInjection
        fields = ["fault_type", "target", "parameters", "hypothesis", "expected_behavior", "rto_target_seconds"]

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

        # Validate probe_url if present
        if "probe_url" in params and params["probe_url"]:
            probe_val = str(params["probe_url"]).strip()
            if not (probe_val.startswith("http://") or probe_val.startswith("https://")):
                raise serializers.ValidationError({"parameters": "probe_url must start with http:// or https://."})
            params["probe_url"] = probe_val

        if "expected_status" in params and params["expected_status"] is not None:
            try:
                st_code = int(params["expected_status"])
                if st_code < 100 or st_code > 599:
                    raise serializers.ValidationError({"parameters": "expected_status must be a valid HTTP status code (100-599)."})
                params["expected_status"] = st_code
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "expected_status must be an integer."})

        # Validate hypothesis & expected behavior if present
        if "hypothesis" in params and params["hypothesis"]:
            params["hypothesis"] = str(params["hypothesis"]).strip()

        if "expected_behavior" in params and params["expected_behavior"]:
            params["expected_behavior"] = str(params["expected_behavior"]).strip()

        if "rto_target_seconds" in params and params["rto_target_seconds"] is not None:
            try:
                rto_t = float(params["rto_target_seconds"])
                if rto_t <= 0 or rto_t > 300:
                    raise serializers.ValidationError({"parameters": "rto_target_seconds must be between 0.1 and 300 seconds."})
                params["rto_target_seconds"] = round(rto_t, 2)
            except (ValueError, TypeError):
                raise serializers.ValidationError({"parameters": "rto_target_seconds must be a valid number."})

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

        # Sync top-level hypothesis fields into parameters
        if "hypothesis" in attrs and attrs["hypothesis"]:
            params["hypothesis"] = str(attrs["hypothesis"]).strip()
        if "expected_behavior" in attrs and attrs["expected_behavior"]:
            params["expected_behavior"] = str(attrs["expected_behavior"]).strip()
        if "rto_target_seconds" in attrs and attrs["rto_target_seconds"] is not None:
            params["rto_target_seconds"] = attrs["rto_target_seconds"]

        attrs["parameters"] = params
        return attrs

    def create(self, validated_data):
        validated_data.pop("hypothesis", None)
        validated_data.pop("expected_behavior", None)
        validated_data.pop("rto_target_seconds", None)
        return super().create(validated_data)


from .models import FaultInjection, FaultInjectionLog


class FaultInjectionLogSerializer(serializers.ModelSerializer):
    fault_id = serializers.ReadOnlyField(source="fault.id")
    injection_id = serializers.ReadOnlyField(source="fault.id")

    class Meta:
        model = FaultInjectionLog
        fields = ["id", "fault_id", "injection_id", "timestamp", "level", "message"]
        read_only_fields = ["id", "fault_id", "injection_id", "timestamp"]


class FaultInjectionListSerializer(serializers.ModelSerializer):
    injection_id = serializers.ReadOnlyField(source="id")
    created_at = serializers.DateTimeField(source="requested_at", read_only=True)
    project_id = serializers.ReadOnlyField(source="project.id")
    project_title = serializers.ReadOnlyField(source="project.title")
    project_code = serializers.ReadOnlyField(source="project.connection_code")
    requested_by = ProjectUserSerializer(read_only=True)
    duration_seconds = serializers.SerializerMethodField()
    logs_count = serializers.SerializerMethodField()
    resilience_score = serializers.SerializerMethodField()
    resilience_grade = serializers.SerializerMethodField()
    classification = serializers.SerializerMethodField()
    recommendations = serializers.SerializerMethodField()
    hypothesis = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    expected_behavior = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    rto_target_seconds = serializers.FloatField(required=False, default=5.0)

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
            "resilience_score",
            "resilience_grade",
            "classification",
            "recommendations",
            "hypothesis",
            "expected_behavior",
            "rto_target_seconds",
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
            "resilience_score",
            "resilience_grade",
            "classification",
            "recommendations",
            "hypothesis",
            "expected_behavior",
            "rto_target_seconds",
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
        if hasattr(obj, "annotated_logs_count"):
            return obj.annotated_logs_count
        if hasattr(obj, "logs"):
            return obj.logs.count()
        return 0

    def get_resilience_score(self, obj):
        res = obj.result or {}
        return res.get("resilience_score") or (res.get("resilience") or {}).get("score")

    def get_resilience_grade(self, obj):
        res = obj.result or {}
        return res.get("resilience_grade") or (res.get("resilience") or {}).get("grade")

    def get_classification(self, obj):
        res = obj.result or {}
        return res.get("classification") or (res.get("resilience") or {}).get("classification")

    def get_recommendations(self, obj):
        res = obj.result or {}
        return res.get("recommendations") or (res.get("resilience") or {}).get("recommendations") or []

    def create(self, validated_data):
        hypothesis = validated_data.pop("hypothesis", None)
        expected_behavior = validated_data.pop("expected_behavior", None)
        rto_target = validated_data.pop("rto_target_seconds", None)

        parameters = validated_data.get("parameters") or {}
        if hypothesis and "hypothesis" not in parameters:
            parameters["hypothesis"] = hypothesis
        if expected_behavior and "expected_behavior" not in parameters:
            parameters["expected_behavior"] = expected_behavior
        if rto_target is not None and "rto_target_seconds" not in parameters:
            parameters["rto_target_seconds"] = rto_target
        validated_data["parameters"] = parameters

        return super().create(validated_data)

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        params = instance.parameters or {}
        res = instance.result or {}

        if not ret.get("hypothesis"):
            ret["hypothesis"] = params.get("hypothesis") or (res.get("hypothesis_evaluation") or {}).get("hypothesis")
        if not ret.get("expected_behavior"):
            ret["expected_behavior"] = params.get("expected_behavior") or (res.get("hypothesis_evaluation") or {}).get("expected_behavior")
        if not ret.get("rto_target_seconds") or ret.get("rto_target_seconds") == 5.0:
            if "rto_target_seconds" in params:
                ret["rto_target_seconds"] = params["rto_target_seconds"]
            elif "rto_target_seconds" in (res.get("recovery_metrics") or {}):
                ret["rto_target_seconds"] = res["recovery_metrics"]["rto_target_seconds"]

        return ret


class FaultInjectionSerializer(FaultInjectionListSerializer):
    structured_report = serializers.SerializerMethodField()

    class Meta(FaultInjectionListSerializer.Meta):
        fields = FaultInjectionListSerializer.Meta.fields + ["structured_report"]
        read_only_fields = FaultInjectionListSerializer.Meta.read_only_fields + ["structured_report"]

    def get_structured_report(self, obj):
        from .chaos_reporting import generate_experiment_report
        return generate_experiment_report(obj)


class FaultInjectionReportSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        FaultInjection.Status.COMPLETED,
        FaultInjection.Status.FAILED,
        FaultInjection.Status.CANCELLED,
    ])
    result = serializers.JSONField(default=dict, required=False)
    error_message = serializers.CharField(required=False, allow_blank=True, default="")