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
        if user.role == User.Role.COMPANY:
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
        if user.role == User.Role.COMPANY:
            return Project.objects.filter(owner=user)
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            return Project.objects.filter(
                Q(owner=user) | Q(owner=company_owner) | Q(assigned_teams__members=user)
            ).distinct()
        else:
            return Project.objects.filter(owner=user)

class CliProjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SingleProjectSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "connection_code"

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.COMPANY:
            return Project.objects.filter(owner=user)
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            return Project.objects.filter(
                Q(owner=user) | Q(owner=company_owner) | Q(assigned_teams__members=user)
            ).distinct()
        else:
            return Project.objects.filter(owner=user)


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

        try:
            if str(project_id).isdigit():
                project = Project.objects.get(id=int(project_id))
            else:
                project = Project.objects.get(connection_code=project_id)
        except (Project.DoesNotExist, ValueError):
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

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

    def get(self, request, pk):
        try:
            test_run = TestRun.objects.get(pk=pk)
            return Response(TestRunSerializer(test_run).data)
        except TestRun.DoesNotExist:
            return Response({"detail": "Test run not found."}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk):
        try:
            test_run = TestRun.objects.get(pk=pk)
            test_run.delete()
            return Response({"message": "Test run deleted successfully."})
        except TestRun.DoesNotExist:
            return Response({"detail": "Test run not found."}, status=status.HTTP_404_NOT_FOUND)


class ProjectProfileUpdateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier):
        user = request.user

        project = None
        if str(identifier).isdigit():
            project = Project.objects.filter(id=int(identifier)).first()
        if not project:
            project = Project.objects.filter(connection_code=identifier).first()

        if not project:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == User.Role.COMPANY:
            if project.owner != user and getattr(user, 'company_profile', None) != project.owner.company:
                pass
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            if project.owner != user and project.owner != company_owner and not project.assigned_teams.filter(members=user).exists():
                return Response({"detail": "Permission denied for this project."}, status=status.HTTP_403_FORBIDDEN)
        elif project.owner != user:
            return Response({"detail": "Permission denied for this project."}, status=status.HTTP_403_FORBIDDEN)

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
    throttle_classes = []

    def post(self, request, identifier):
        if identifier.isdigit():
            project = get_object_or_404(Project, pk=identifier)
        else:
            project = get_object_or_404(Project, connection_code__iexact=identifier)

        log_line = request.data.get("log", "")
        stream_type = request.data.get("stream", "stdout")
        timestamp = request.data.get("timestamp")
        event = request.data.get("event")

        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()

        # Mark project stream as active in cache for 120 seconds
        cache_key_upper = f"core_active_stream_{code_upper}"
        cache_key_lower = f"core_active_stream_{code_lower}"
        if event in ["run_end", "analysis_end"]:
            cache.delete(cache_key_upper)
            cache.delete(cache_key_lower)
        else:
            cache.set(cache_key_upper, True, timeout=120)
            cache.set(cache_key_lower, True, timeout=120)

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
    throttle_classes = []

    def get(self, request, identifier):
        if identifier.isdigit():
            project = get_object_or_404(Project, pk=identifier)
        else:
            project = get_object_or_404(Project, connection_code__iexact=identifier)

        code_upper = project.connection_code.upper()
        code_lower = project.connection_code.lower()
        is_active = bool(cache.get(f"core_active_stream_{code_upper}") or cache.get(f"core_active_stream_{code_lower}"))

        return Response({
            "is_active": is_active,
            "project_code": project.connection_code
        }, status=status.HTTP_200_OK)


from django.utils import timezone
from .models import FaultInjection
from .serializers import (
    FaultInjectionSerializer,
    FaultInjectionCreateSerializer,
    FaultInjectionReportSerializer,
)


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

    if user.is_staff or user.is_superuser or project.owner == user:
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


class ProjectFaultListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        status_filter = request.query_params.get("status")
        queryset = project.fault_injections.all()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        serializer = FaultInjectionSerializer(queryset[:100], many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        serializer = FaultInjectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fault = serializer.save(
            project=project,
            requested_by=request.user,
            status=FaultInjection.Status.PENDING,
        )
        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_201_CREATED)


class ProjectFaultPendingAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        pending = (
            project.fault_injections.filter(status=FaultInjection.Status.PENDING)
            .order_by("requested_at")
            .first()
        )
        if not pending:
            return Response({"pending": False, "fault": None}, status=status.HTTP_200_OK)

        return Response(
            {"pending": True, "fault": FaultInjectionSerializer(pending).data},
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
        if fault.status != FaultInjection.Status.PENDING:
            return Response(
                {"detail": f"Cannot cancel fault in '{fault.status}' state."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fault.status = FaultInjection.Status.CANCELLED
        fault.save(update_fields=["status"])
        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectFaultClaimAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        if fault.status != FaultInjection.Status.PENDING:
            return Response(
                {"detail": f"Fault is in '{fault.status}' state and cannot be claimed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fault.status = FaultInjection.Status.RUNNING
        fault.started_at = timezone.now()
        fault.save(update_fields=["status", "started_at"])
        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectFaultReportAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, identifier, fault_id):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        fault = get_object_or_404(FaultInjection, pk=fault_id, project=project)
        if fault.status not in (FaultInjection.Status.RUNNING, FaultInjection.Status.PENDING):
            return Response(
                {"detail": f"Fault is already in terminal state '{fault.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = FaultInjectionReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        fault.status = serializer.validated_data["status"]
        fault.completed_at = timezone.now()
        fault.result = serializer.validated_data.get("result", {})
        fault.error_message = serializer.validated_data.get("error_message", "")
        fault.save(update_fields=["status", "completed_at", "result", "error_message"])
        return Response(FaultInjectionSerializer(fault).data, status=status.HTTP_200_OK)


class ProjectContainersAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, identifier):
        project, err_resp = get_project_with_permission(identifier, request.user)
        if err_resp:
            return err_resp

        profile = getattr(project, "profile", None)
        containers = profile.docker_containers if profile else []
        return Response({
            "project_id": project.id,
            "connection_code": project.connection_code,
            "containers": containers,
            "docker_containers": containers,
            "total": len(containers)
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