from django.urls import path,include
from .views import *
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('register/company/', CompanyRegisterView.as_view(), name='register_company'),
    path('company/me/', CompanyMeView.as_view(), name='company_me'),
    path('admin/companies/', AdminCompanyListView.as_view(), name='admin_company_list'),
    path('admin/companies/<int:pk>/', AdminCompanyDetailView.as_view(), name='admin_company_detail'),

    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path("api-auth", include("rest_framework.urls", namespace="rest_framework")),
    path('github/login/', github_login, name='github_login'),
    path('github/login/callback/', github_callback, name='github_callback'),
    path('google/login/', google_login, name='google_login'),
    path('google/login/callback/', google_callback, name='google_callback'),
    path('common-auth/callback/', social_auth, name='common_social_auth'),
    path('me/', whoami, name="whoami"),

    # Company & Developer Management
    path('company/available-developers/', CompanyAvailableDevelopersView.as_view(), name='company_available_developers'),
    path('company/developer-requests/', CompanyDeveloperRequestListCreateView.as_view(), name='company_developer_requests'),
    path('company/developer-requests/<int:pk>/cancel/', CompanyDeveloperRequestCancelView.as_view(), name='company_developer_request_cancel'),
    path('company/developers/', CompanyActiveDevelopersView.as_view(), name='company_active_developers'),
    path('company/developers/<int:pk>/', CompanyActiveDevelopersView.as_view(), name='company_remove_developer'),
    path('developer/company-requests/', DeveloperCompanyRequestsView.as_view(), name='developer_company_requests'),
    path('developer/company-requests/<int:pk>/respond/', DeveloperRespondCompanyRequestView.as_view(), name='developer_respond_company_request'),

    # Notifications & Inbox
    path('notifications/', NotificationListView.as_view(), name='notification_list'),
    path('notifications/unread-count/', NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notification_read_all'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
    path('notifications/<int:pk>/', NotificationDeleteView.as_view(), name='notification_delete'),

    # Developer Teams & Organization Profile
    path('company/teams/', CompanyTeamListCreateView.as_view(), name='company_teams'),
    path('company/teams/<int:pk>/', CompanyTeamDetailView.as_view(), name='company_team_detail'),
    path('organization/', DeveloperOrganizationDetailView.as_view(), name='developer_organization_detail'),
]


