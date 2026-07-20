from django.urls import path,include
from .views import CreateUserView, LogoutView, EmailTokenObtainPairView, github_callback
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('register/', CreateUserView.as_view(), name='register'),
    path('login/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path("api-auth", include("rest_framework.urls", namespace="rest_framework")),
    path('github/callback/', github_callback, name='github_callback'),
]

