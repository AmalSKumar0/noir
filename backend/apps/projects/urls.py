
from django.urls import path
from .views import (
    ProjectListView,
    ProjectCreateAPIView,
    MyProjectListView,
    ProjectDetailView,
    CliProjectDetailView,
    TestRunListCreateView,
    TestRunDetailView,
    ProjectProfileUpdateAPIView,
    StreamProjectLogsAPIView,
    ProjectStreamStatusAPIView,
    ProjectFaultListCreateAPIView,
    ProjectFaultPendingAPIView,
    ProjectFaultDetailAPIView,
    ProjectFaultCancelAPIView,
    ProjectFaultClaimAPIView,
    ProjectFaultReportAPIView,
    ProjectFaultLogsAPIView,
    ProjectFaultAppendLogAPIView,
    ProjectFaultStatusAPIView,
    ProjectContainersAPIView,
)

urlpatterns = [
    path("all/", ProjectListView.as_view()),
    path("create/", ProjectCreateAPIView.as_view()),
    path("my/", MyProjectListView.as_view()),
    path("<int:pk>/", ProjectDetailView.as_view()),
    path("connection-id/<str:connection_code>/", CliProjectDetailView.as_view()),
    path("<str:identifier>/profile/", ProjectProfileUpdateAPIView.as_view(), name="project_profile_update"),
    path("<str:identifier>/containers/", ProjectContainersAPIView.as_view(), name="project_containers"),
    path("<str:identifier>/stream-logs/", StreamProjectLogsAPIView.as_view(), name="project_stream_logs"),
    path("<str:identifier>/stream-status/", ProjectStreamStatusAPIView.as_view(), name="project_stream_status"),
    path("<str:identifier>/faults/", ProjectFaultListCreateAPIView.as_view(), name="project_faults_list_create"),
    path("<str:identifier>/faults/pending/", ProjectFaultPendingAPIView.as_view(), name="project_faults_pending"),
    path("<str:identifier>/faults/<int:fault_id>/", ProjectFaultDetailAPIView.as_view(), name="project_fault_detail"),
    path("<str:identifier>/faults/<int:fault_id>/claim/", ProjectFaultClaimAPIView.as_view(), name="project_fault_claim"),
    path("<str:identifier>/faults/<int:fault_id>/report/", ProjectFaultReportAPIView.as_view(), name="project_fault_report"),
    path("<str:identifier>/faults/<int:fault_id>/cancel/", ProjectFaultCancelAPIView.as_view(), name="project_fault_cancel"),
    path("<str:identifier>/faults/<int:fault_id>/logs/", ProjectFaultLogsAPIView.as_view(), name="project_fault_logs"),
    path("<str:identifier>/faults/<int:fault_id>/log/", ProjectFaultAppendLogAPIView.as_view(), name="project_fault_append_log"),
    path("<str:identifier>/faults/<int:fault_id>/status/", ProjectFaultStatusAPIView.as_view(), name="project_fault_status"),
    path("test-runs/", TestRunListCreateView.as_view(), name="test_runs_list_create"),
    path("test-runs/<int:pk>/", TestRunDetailView.as_view(), name="test_run_detail"),
]


