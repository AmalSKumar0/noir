
from django.urls import path
from .views import (
    ProjectListView,
    ProjectCreateAPIView,
    MyProjectListView,
    ProjectDetailView,
    CliProjectDetailView,
    TestRunListCreateView,
    TestRunDetailView,
)

urlpatterns = [
    path("all/", ProjectListView.as_view()),
    path("create/", ProjectCreateAPIView.as_view()),
    path("my/", MyProjectListView.as_view()),
    path("<int:pk>/", ProjectDetailView.as_view()),
    path("connection-id/<str:connection_code>/", CliProjectDetailView.as_view()),
    path("test-runs/", TestRunListCreateView.as_view(), name="test_runs_list_create"),
    path("test-runs/<int:pk>/", TestRunDetailView.as_view(), name="test_run_detail"),
]

