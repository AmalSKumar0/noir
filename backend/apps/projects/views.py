from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView, CreateAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin
from apps.accounts.models import User, DeveloperTeam, CompanyProfile
from .models import Project, TestRun
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
            queryset = TestRun.objects.filter(project__owner=user)
        elif user.role == User.Role.DEVELOPER and user.company:
            company_owner = user.company.user
            queryset = TestRun.objects.filter(
                Q(project__owner=company_owner) | Q(project__assigned_teams__members=user) | Q(executor=user)
            ).distinct()
        else:
            queryset = TestRun.objects.filter(Q(project__owner=user) | Q(executor=user)).distinct()

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
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
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