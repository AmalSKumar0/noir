from django.urls import path,include
from .views import CreateUserView, LogoutView, EmailTokenObtainPairView, github_login,github_callback, google_login, social_auth,google_callback
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', CreateUserView.as_view(), name='register'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path("api-auth", include("rest_framework.urls", namespace="rest_framework")),
    path('github/login/', github_login, name='github_login'),
    path('github/login/callback/', github_callback, name='github_callback'),
    path('google/login/', google_login, name='google_login'),
    path('google/login/callback/', google_callback, name='google_callback'),
    path('common-auth/callback/', social_auth, name='common_social_auth'),
]

