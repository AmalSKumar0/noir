from rest_framework.generics import ListAPIView,RetrieveUpdateDestroyAPIView,CreateAPIView
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin
from apps.accounts.models import User
from .models import Project
from .serializers import ProjectSerializer,SingleProjectSerializer
from core.pagination import  DefaultPagination
from apps.users.throttles import UserListThrottle,UserDeleteThrottle
from django.shortcuts import get_object_or_404


class ProjectListView(ListAPIView):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated,IsAdmin]
    pagination_class = DefaultPagination
    throttle_classes = [UserListThrottle]

class MyProjectListView(ListAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = DefaultPagination

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

class ProjectCreateAPIView(CreateAPIView):
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]


    def perform_create(self, serializer):
        print(serializer)
        serializer.save(owner=self.request.user)


class ProjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SingleProjectSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Project.objects
            .filter(owner=self.request.user)
            .select_related(
                "profile",
                "profile__framework",
                "owner",
            )
        )

class CliProjectDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = SingleProjectSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "connection_code"

    def get_queryset(self):
        return (
            Project.objects
            .filter(owner=self.request.user)
            .select_related(
                "profile",
                "profile__framework",
                "owner",
            )
        )