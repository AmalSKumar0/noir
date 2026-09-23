from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView, CreateAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin
from apps.accounts.models import User, DeveloperTeam, CompanyProfile
from .models import Project, TestRun, ProjectProfile, Framework
from .serializers import ProjectSerializer, SingleProjectSerializer, TestRunSerializer
from core.pagination import DefaultPagination
from apps.users.throttles import UserListThrottle, UserDeleteThrottle
from django.shortcuts import get_object_or_404
from django.db.models import Q

def get_project_with_permission(identifier, user):
    """
    Look up project by ID or connection_code and check user permissions.
    Returns (project, None) on success or (None, Response) on error.
    """
    if str(identifier).isdigit():
        project = Project.objects.filter(id=int(identifier)).first()
    else:
        project = Project.objects.filter(connection_code__iexact=identifier).first()

    if not project:
        return None, Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

    if user.is_staff or user.is_superuser or getattr(user, "role", None) == "admin" or project.owner == user:
        return project, None

    if user.role == User.Role.COMPANY:
        if hasattr(user, "company_profile") and project.owner.company == user.company_profile:
            return project, None
        return None, Response({"detail": "Permission denied for this project."}, status=status.HTTP_403_FORBIDDEN)

    if user.role == User.Role.DEVELOPER and user.company:
        company_owner = user.company.user
        if (
            project.owner == company_owner
            or (hasattr(project, "assigned_teams") and project.assigned_teams.filter(members=user).exists())
        ):
            return project, None
        return None, Response({"detail": "Permission denied for this project."}, status=status.HTTP_403_FORBIDDEN)

    return None, Response({"detail": "Permission denied for this project."}, status=status.HTTP_403_FORBIDDEN)


def _normalize_container_item(c):
    if not isinstance(c, dict):
        return c
    norm = dict(c)
    if "image" in norm and isinstance(norm["image"], str):
        norm["image"] = norm["image"].strip().lower()
    if "name" in norm and isinstance(norm["name"], str):
        if norm.get("status") in ("defined", "defined (not started)"):
            norm["name"] = norm["name"].strip().lower()
    return norm


class ProjectListView(ListAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = DefaultPagination
    throttle_classes = [UserListThrottle]

class MyProjectListView(ListAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.is_staff or getattr(user, "role", None) == "admin":
            return Project.objects.all().order_by("-updated_at")
        elif user.role == User.Role.COMPANY:
            if hasattr(user, "company_profile"):
                return Project.objects.filter(
                    Q(owner=user) | Q(owner__company=user.company_profile)
                ).distinct().order_by("-updated_at")
            return Project.objects.filter(owner=user).order_by("-updated_at")
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            return Project.objects.filter(
                Q(owner=user) | Q(owner=company_owner) | Q(assigned_teams__members=user)
            ).distinct().order_by("-updated_at")
        else:
            return Project.objects.filter(owner=user).order_by("-updated_at")

class ProjectCreateAPIView(CreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ProjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SingleProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.is_staff or getattr(user, "role", None) == "admin":
            return Project.objects.all()
        elif user.role == User.Role.COMPANY:
            if hasattr(user, "company_profile"):
                return Project.objects.filter(
                    Q(owner=user) | Q(owner__company=user.company_profile)
                ).distinct()
            return Project.objects.filter(owner=user)
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            return Project.objects.filter(
                Q(owner=user) | Q(owner=company_owner) | Q(assigned_teams__members=user)
            ).distinct()
        else:
            return Project.objects.filter(owner=user)

    def perform_destroy(self, instance):
        if instance.connection_code:
            code_upper = instance.connection_code.upper()
            code_lower = instance.connection_code.lower()
            cache.delete(f"core_active_stream_{code_upper}")
            cache.delete(f"core_active_stream_{code_lower}")
            cache.delete(f"core_daemon_active_{code_upper}")
            cache.delete(f"core_daemon_active_{code_lower}")
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        project_name = instance.title
        self.perform_destroy(instance)
        return Response(
            {"message": f"Project '{project_name}' deleted successfully."},
            status=status.HTTP_200_OK
        )

class CliProjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SingleProjectSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "connection_code"

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.is_staff or getattr(user, "role", None) == "admin":
            return Project.objects.all()
        elif user.role == User.Role.COMPANY:
            if hasattr(user, "company_profile"):
                return Project.objects.filter(
                    Q(owner=user) | Q(owner__company=user.company_profile)
                ).distinct()
            return Project.objects.filter(owner=user)
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            return Project.objects.filter(
                Q(owner=user) | Q(owner=company_owner) | Q(assigned_teams__members=user)
            ).distinct()
        else:
            return Project.objects.filter(owner=user)

    def perform_destroy(self, instance):
        if instance.connection_code:
            code_upper = instance.connection_code.upper()
            code_lower = instance.connection_code.lower()
            cache.delete(f"core_active_stream_{code_upper}")
            cache.delete(f"core_active_stream_{code_lower}")
            cache.delete(f"core_daemon_active_{code_upper}")
            cache.delete(f"core_daemon_active_{code_lower}")
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        project_name = instance.title
        self.perform_destroy(instance)
        return Response(
            {"message": f"Project '{project_name}' deleted successfully."},
            status=status.HTTP_200_OK
        )


class TestRunListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        project_id = request.GET.get("project_id")
        team_id = request.GET.get("team_id")
        executor_id = request.GET.get("executor_id") or request.GET.get("developer_id")
        status_filter = request.GET.get("status")

        if user.role == User.Role.COMPANY and hasattr(user, "company_profile"):
            queryset = TestRun.objects.filter(
                Q(project__owner=user) | Q(project__owner__company=user.company_profile) | Q(project__assigned_teams__company=user.company_profile)
            ).distinct().order_by("-created_at")
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            queryset = TestRun.objects.filter(
                Q(project__owner=company_owner) | Q(project__assigned_teams__members=user) | Q(executor=user)
            ).distinct().order_by("-created_at")
        else:
            queryset = TestRun.objects.filter(Q(project__owner=user) | Q(executor=user)).distinct().order_by("-created_at")

        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        if executor_id:
            queryset = queryset.filter(executor_id=executor_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        serializer = TestRunSerializer(queryset[:100], many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        project_id = request.data.get("project_id") or request.data.get("project")
        if not project_id:
            return Response({"detail": "Project ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        project, err_resp = get_project_with_permission(project_id, user)
        if err_resp:
            return err_resp

        # Detect team
        team = None
        if user.role == User.Role.DEVELOPER and user.company:
            team = DeveloperTeam.objects.filter(company=user.company, members=user, projects=project).first()
            if not team:
                team = DeveloperTeam.objects.filter(company=user.company, members=user).first()
        elif user.role == User.Role.COMPANY and hasattr(user, "company_profile"):
            team = DeveloperTeam.objects.filter(company=user.company_profile, projects=project).first()

        suite_name = request.data.get("suite_name", "Default Integration Suite")
        test_status = request.data.get("status", TestRun.Status.PASSED)
        command = request.data.get("command", "npm test")
        total_tests = int(request.data.get("total_tests", 0))
        passed_tests = int(request.data.get("passed_tests", 0))
        failed_tests = int(request.data.get("failed_tests", 0))
        skipped_tests = int(request.data.get("skipped_tests", 0))
        duration_ms = int(request.data.get("duration_ms", 0))
        logs = request.data.get("logs", "")

        test_run = TestRun.objects.create(
            project=project,
            executor=user,
            team=team,
            suite_name=suite_name,
            status=test_status,
            command=command,
            total_tests=total_tests,
            passed_tests=passed_tests,
            failed_tests=failed_tests,
            skipped_tests=skipped_tests,
            duration_ms=duration_ms,
            logs=logs
        )

        return Response(TestRunSerializer(test_run).data, status=status.HTTP_201_CREATED)


class TestRunDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        test_run = TestRun.objects.filter(pk=pk).select_related("project").first()
        if not test_run:
            return None, Response({"detail": "Test run not found."}, status=status.HTTP_404_NOT_FOUND)
        _, err_resp = get_project_with_permission(test_run.project.id, user)
        if err_resp:
            return None, err_resp
        return test_run, None

    def get(self, request, pk):
        test_run, err = self.get_object(pk, request.user)
        if err:
            return err
        return Response(TestRunSerializer(test_run).data)

    def delete(self, request, pk):
        test_run, err = self.get_object(pk, request.user)
        if err:
            return err
        test_run.delete()
        return Response({"message": "Test run deleted successfully."})


class ProjectProfileUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier):
        user = request.user
        project, err_resp = get_project_with_permission(identifier, user)
        if err_resp:
            return err_resp

        framework_name = request.data.get("framework_name") or request.data.get("framework") or "Generic"
        language = request.data.get("language") or "Python"
        runtime_version = request.data.get("runtime_version") or "Unknown"
        package_manager = request.data.get("package_manager") or "npm"
        operating_system = request.data.get("operating_system") or "Linux"

        default_test = "pytest" if "python" in language.lower() else "npm test"
        framework, _ = Framework.objects.get_or_create(
            name=framework_name,
            defaults={
                "language": language,
                "default_test_command": default_test,
                "detection_file": "Lynx Auto-Detector",
                "supported": True
            }
        )
        if framework.language != language:
            framework.language = language
            framework.save()

        analysis_data = request.data.get("analysis_data") or request.data.get("summary") or {}
        docker_containers = request.data.get("docker_containers")
        if docker_containers is None and isinstance(analysis_data, dict):
            docker_containers = analysis_data.get("docker_containers")
        if docker_containers is None:
            existing = ProjectProfile.objects.filter(project=project).first()
            docker_containers = existing.docker_containers if existing else []

        if isinstance(docker_containers, list):
            docker_containers = [_normalize_container_item(c) for c in docker_containers]

        profile, _ = ProjectProfile.objects.update_or_create(
            project=project,
            defaults={
                "framework": framework,
                "runtime_version": runtime_version,
                "package_manager": package_manager,
                "operating_system": operating_system,
                "analysis_data": analysis_data,
                "docker_containers": docker_containers,
            }
        )

        return Response({
            "message": "Project profile updated successfully",
            "project_id": project.id,
            "connection_code": project.connection_code,
            "profile": SingleProjectSerializer(project).data.get("profile")
        }, status=status.HTTP_200_OK)


from django.core.cache import cache
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

class StreamProjectLogsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        log_line = request.data.get("log", "")
        stream_type = request.data.get("stream", "stdout")
        timestamp = request.data.get("timestamp")
        event = request.data.get("event")

        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()

        # Mark project stream as active in cache for 120 seconds
        cache_key_upper = f"core_active_stream_{code_upper}"
        cache_key_lower = f"core_active_stream_{code_lower}"
        if event in ["run_end", "analysis_end", "daemon_stop"]:
            cache.delete(cache_key_upper)
            cache.delete(cache_key_lower)
            if event == "daemon_stop":
                cache.delete(f"core_daemon_active_{code_upper}")
                cache.delete(f"core_daemon_active_{code_lower}")
        else:
            cache.set(cache_key_upper, True, timeout=120)
            cache.set(cache_key_lower, True, timeout=120)
            if event == "daemon_start":
                cache.set(f"core_daemon_active_{code_upper}", True, timeout=15)
                cache.set(f"core_daemon_active_{code_lower}", True, timeout=15)

        channel_layer = get_channel_layer()
        if channel_layer:
            payload = {
                "type": "log_message",
                "data": {
                    "project_code": project.connection_code,
                    "log": log_line,
                    "stream": stream_type,
                    "timestamp": timestamp,
                    "event": event,
                }
            }
            async_to_sync(channel_layer.group_send)(f"project_{code_upper}", payload)
            async_to_sync(channel_layer.group_send)(f"project_{code_lower}", payload)

        return Response({"status": "broadcasted", "project_code": project.connection_code}, status=status.HTTP_200_OK)


class ProjectStreamStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()
        is_streaming = bool(cache.get(f"core_active_stream_{code_upper}") or cache.get(f"core_active_stream_{code_lower}"))
        is_daemon_active = bool(cache.get(f"core_daemon_active_{code_upper}") or cache.get(f"core_daemon_active_{code_lower}"))
        last_seen = cache.get(f"core_daemon_last_seen_{code_upper}")

        return Response({
            "is_active": is_streaming or is_daemon_active,
            "is_streaming": is_streaming,
            "is_daemon_active": is_daemon_active,
            "last_seen": last_seen,
            "project_code": project.connection_code
        }, status=status.HTTP_200_OK)


from django.utils import timezone
from django.conf import settings
from .models import FaultInjection, FaultInjectionLog
from .serializers import (
    FaultInjectionSerializer,
    FaultInjectionCreateSerializer,
    FaultInjectionReportSerializer,
    FaultInjectionLogSerializer,
)


def broadcast_fault_event(project, event_dict):
    """
    Broadcasts structured fault injection event across Django Channels groups:
    project_{code_upper} and project_{code_lower}.
    """
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    code = getattr(project, "connection_code", None)
    if not code:
        return
    payload = {
        "type": "log_message",
        "data": event_dict,
    }
    try:
        async_to_sync(channel_layer.group_send)(f"project_{code.upper()}", payload)
        async_to_sync(channel_layer.group_send)(f"project_{code.lower()}", payload)
    except Exception as e:
        print(f"[Broadcast Error] Failed to broadcast fault event: {e}")


class ProjectFaultListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        status_filter = request.query_params.get("status")
        queryset = project.fault_injections.all().order_by("-requested_at")
        if status_filter:
            # Map legacy 'pending' query to 'queued'
            if status_filter.lower() == "pending":
                status_filter = FaultInjection.Status.QUEUED
            queryset = queryset.filter(status=status_filter)

        serializer = FaultInjectionSerializer(queryset[:150], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        # Verify that 'noir fault listen' daemon is actively running
        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()
        is_daemon_active = bool(
            cache.get(f"core_daemon_active_{code_upper}") or 
            cache.get(f"core_daemon_active_{code_lower}")
        )

        allow_offline = (
            request.data.get("allow_offline", False) or 
            request.query_params.get("allow_offline", False) or
            getattr(settings, "ALLOW_OFFLINE_QUEUING", False)
        )

        if not is_daemon_active and not allow_offline:
            return Response(
                {
                    "detail": "Cannot queue fault: The Noir daemon ('noir fault listen') is not running. Please start the listener in your project workspace using 'noir fault listen' first.",
                    "command": "noir fault listen",
                    "code": "daemon_inactive",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = FaultInjectionCreateSerializer(data=request.data, context={"project": project})
        serializer.is_valid(raise_exception=True)
        fault = serializer.save(
            project=project,
            requested_by=request.user,
            status=FaultInjection.Status.QUEUED,
        )

        # Log initial queued state
        queue_pos = project.fault_injections.filter(status=FaultInjection.Status.QUEUED).count()
        FaultInjectionLog.objects.create(
            fault=fault,
            level="INFO",
            message=f"Fault injection #{fault.id} ({fault.fault_type}) queued for target '{fault.target}' (position #{queue_pos}).",
        )

        # Broadcast real-time status event
        broadcast_fault_event(project, {
            "type": "injection.status",
            "injection_id": fault.id,
            "status": FaultInjection.Status.QUEUED,
            "fault": FaultInjectionSerializer(fault).data,
        })

        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_201_CREATED)


class ProjectFaultPendingAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        # Mark daemon active on every poll (timeout=12s covers standard 2s polling interval)
        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()
        cache.set(f"core_daemon_active_{code_upper}", True, timeout=12)
        cache.set(f"core_daemon_active_{code_lower}", True, timeout=12)
        cache.set(f"core_daemon_last_seen_{code_upper}", timezone.now().isoformat(), timeout=3600)

        # Check concurrency limit policy
        try:
            param_concurrency = int(request.query_params.get("concurrency", 0))
        except (ValueError, TypeError):
            param_concurrency = 0

        max_concurrency = param_concurrency or getattr(settings, "MAX_CONCURRENT_INJECTIONS", 1)
        running_count = project.fault_injections.filter(status=FaultInjection.Status.RUNNING).count()

        if running_count >= max_concurrency:
            return Response(
                {
                    "pending": False,
                    "fault": None,
                    "reason": "concurrency_limit_reached",
                    "running_count": running_count,
                    "max_concurrency": max_concurrency,
                },
                status=status.HTTP_200_OK,
            )

        # Retrieve next FIFO queued injection
        pending = (
            project.fault_injections.filter(status__in=[FaultInjection.Status.QUEUED, "pending"])
            .order_by("requested_at")
            .first()
        )
        if not pending:
            return Response({
                "pending": False, 
                "fault": None,
                "running_count": running_count,
                "max_concurrency": max_concurrency,
            }, status=status.HTTP_200_OK)

        return Response(
            {
                "pending": True,
                "fault": FaultInjectionSerializer(pending).data,
                "running_count": running_count,
                "max_concurrency": max_concurrency,
            },
            status=status.HTTP_200_OK,
        )


class ProjectFaultDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectFaultCancelAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)

        # 1. Queued injection cancellation -> immediate CANCELLED
        if fault.status in (FaultInjection.Status.QUEUED, "pending"):
            fault.status = FaultInjection.Status.CANCELLED
            fault.completed_at = timezone.now()
            fault.save(update_fields=["status", "completed_at"])

            FaultInjectionLog.objects.create(
                fault=fault,
                level="WARN",
                message="Fault injection was cancelled while queued.",
            )

            broadcast_fault_event(project, {
                "type": "injection.cancelled",
                "injection_id": fault.id,
                "status": FaultInjection.Status.CANCELLED,
                "fault": FaultInjectionSerializer(fault).data,
            })
            return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)

        # 2. Running injection cancellation -> CANCEL_REQUESTED (worker safely terminates Docker workload)
        if fault.status == FaultInjection.Status.RUNNING:
            fault.status = FaultInjection.Status.CANCEL_REQUESTED
            fault.save(update_fields=["status"])

            FaultInjectionLog.objects.create(
                fault=fault,
                level="WARN",
                message="Stop requested by user. Signalling execution worker to terminate Docker operations...",
            )

            broadcast_fault_event(project, {
                "type": "injection.status",
                "injection_id": fault.id,
                "status": FaultInjection.Status.CANCEL_REQUESTED,
                "fault": FaultInjectionSerializer(fault).data,
            })
            return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)

        # 3. Idempotent cases
        if fault.status in (FaultInjection.Status.CANCEL_REQUESTED, FaultInjection.Status.CANCELLED):
            return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)

        # 4. Terminal states cannot be cancelled
        return Response(
            {"detail": f"Cannot cancel fault in terminal '{fault.status}' state."},
            status=status.HTTP_400_BAD_REQUEST,
        )


class ProjectFaultClaimAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        if fault.status not in (FaultInjection.Status.QUEUED, "pending"):
            return Response(
                {"detail": f"Fault is in '{fault.status}' state and cannot be claimed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fault.status = FaultInjection.Status.RUNNING
        fault.started_at = timezone.now()
        fault.save(update_fields=["status", "started_at"])

        FaultInjectionLog.objects.create(
            fault=fault,
            level="INFO",
            message=f"Claimed by Noir execution worker. Execution started on target '{fault.target}'.",
        )

        broadcast_fault_event(project, {
            "type": "injection.status",
            "injection_id": fault.id,
            "status": FaultInjection.Status.RUNNING,
            "started_at": fault.started_at.isoformat(),
            "fault": FaultInjectionSerializer(fault).data,
        })

        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectFaultReportAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        if fault.status in (FaultInjection.Status.COMPLETED, FaultInjection.Status.CANCELLED, FaultInjection.Status.FAILED):
            return Response(
                {"detail": f"Fault is already in terminal state '{fault.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = FaultInjectionReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        fault.status = new_status
        fault.completed_at = timezone.now()
        fault.result = serializer.validated_data.get("result", {})
        fault.error_message = serializer.validated_data.get("error_message", "")
        fault.save(update_fields=["status", "completed_at", "result", "error_message"])

        # Persist final log
        log_level = "INFO" if new_status == FaultInjection.Status.COMPLETED else ("WARN" if new_status == FaultInjection.Status.CANCELLED else "ERROR")
        log_msg = f"Fault execution completed with status: {new_status.upper()}."
        if fault.error_message:
            log_msg += f" Details: {fault.error_message}"

        FaultInjectionLog.objects.create(
            fault=fault,
            level=log_level,
            message=log_msg,
        )

        # Broadcast final event
        if new_status == FaultInjection.Status.COMPLETED:
            event_type = "injection.completed"
        elif new_status == FaultInjection.Status.CANCELLED:
            event_type = "injection.cancelled"
        else:
            event_type = "injection.status"

        broadcast_fault_event(project, {
            "type": event_type,
            "injection_id": fault.id,
            "status": new_status,
            "result": fault.result,
            "error_message": fault.error_message,
            "completed_at": fault.completed_at.isoformat(),
            "fault": FaultInjectionSerializer(fault).data,
        })

        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectFaultLogsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        queryset = fault.logs.all().order_by("timestamp", "id")

        since = request.query_params.get("since")
        if since:
            try:
                queryset = queryset.filter(timestamp__gt=since)
            except Exception:
                pass

        serializer = FaultInjectionLogSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectFaultAppendLogAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        message = (request.data.get("message") or request.data.get("log") or "").strip()
        if not message:
            return Response({"detail": "Log message cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        level = (request.data.get("level") or "INFO").strip().upper()

        log_entry = FaultInjectionLog.objects.create(
            fault=fault,
            level=level,
            message=message,
        )

        broadcast_fault_event(project, {
            "type": "injection.log",
            "injection_id": fault.id,
            "timestamp": log_entry.timestamp.isoformat(),
            "level": log_entry.level,
            "message": log_entry.message,
        })

        return Response(FaultInjectionLogSerializer(log_entry).data, status=status.HTTP_201_CREATED)


class ProjectFaultStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        return Response({
            "id": fault.id,
            "injection_id": fault.id,
            "status": fault.status,
            "cancel_requested": fault.status == FaultInjection.Status.CANCEL_REQUESTED,
            "is_terminal": fault.is_terminal,
        }, status=status.HTTP_200_OK)



class ProjectContainersAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        profile = getattr(project, "profile", None)
        containers = profile.docker_containers if profile else []
        norm_containers = [_normalize_container_item(c) for c in containers]
        return Response({
            "project_id": project.id,
            "connection_code": project.connection_code,
            "containers": norm_containers,
            "docker_containers": norm_containers,
            "total": len(norm_containers)
        }, status=status.HTTP_200_OK)

    def post(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        containers = request.data.get("containers")
        if containers is None:
            containers = request.data.get("docker_containers", [])
        if not isinstance(containers, list):
            return Response({"detail": "containers must be a list."}, status=status.HTTP_400_BAD_REQUEST)

        containers = [_normalize_container_item(c) for c in containers]

        profile = getattr(project, "profile", None)
        if not profile:
            framework, _ = Framework.objects.get_or_create(
                name="Generic",
                defaults={"language": "Python", "default_test_command": "pytest", "detection_file": "Lynx Auto-Detector", "supported": True}
            )
            profile = ProjectProfile.objects.create(
                project=project,
                framework=framework,
                operating_system="Linux",
                docker_containers=containers
            )
        else:
            profile.docker_containers = containers
            profile.save(update_fields=["docker_containers"])

        return Response({
            "message": "Containers updated successfully.",
            "project_id": project.id,
            "connection_code": project.connection_code,
            "containers": profile.docker_containers,
            "docker_containers": profile.docker_containers,
            "total": len(profile.docker_containers)
        }, status=status.HTTP_200_OK)