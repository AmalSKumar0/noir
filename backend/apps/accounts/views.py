from django.shortcuts import render,redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import UserSerializer, EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import get_user_model

from .services.google import GoogleOAuthService
from .services.exchange import ExchangeService
from .services.github import GithubOAuthService

import requests

User = get_user_model()


# Create your views here.
class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

# Logout logic: BLacklisting the tokens so on logout the user cannot use the refresh token to get a new access token
class LogoutView(APIView):
    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_205_RESET_CONTENT,
            )
        except Exception:
            return Response(
                {"error": "Invalid refresh token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer



def github_login(request):
    github_client_id = settings.GITHUB_CLIENT_ID
    redirect_uri = settings.BACKEND_BASE_URL
    scope = "read:user user:email"
    response_type = "code"

    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={github_client_id}&"
        f"redirect_uri={redirect_uri}/api/accounts/github/login/callback/&"
        f"scope={scope}&"
        f"response_type={response_type}"
    )
    print(f"Redirecting to GitHub OAuth2 URL: {auth_url}")

    return redirect(auth_url)

def github_callback(request):
    code = request.GET.get("code")

    if not code:
        return redirect(f"{settings.FRONTEND_BASE_URL}/login?error=no_code")
    
    user = GithubOAuthService.authenticate(code)

    exchange_code = ExchangeService.create(user)


    frontend_url = (
        f"{settings.FRONTEND_BASE_URL}/auth/callback"
        f"?authcode={exchange_code}"
    )

    return redirect(frontend_url)

def google_login(request):
    google_client_id = settings.GOOGLE_CLIENT_ID
    redirect_uri = settings.BACKEND_BASE_URL
    scope = "openid email profile"
    response_type = "code"

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={google_client_id}&"
        f"redirect_uri={redirect_uri}/api/accounts/google/login/callback/&"
        f"scope={scope}&"
        f"response_type={response_type}"
    )
    print(f"Redirecting to Google OAuth2 URL: {auth_url}")

    return redirect(auth_url)


def google_callback(request):
    code = request.GET.get("code")

    if not code:
        return redirect(f"{settings.FRONTEND_BASE_URL}/login?error=no_code")
    
    user = GoogleOAuthService.authenticate(code)
    # refresh = RefreshToken.for_user(user)

    exchange_code = ExchangeService.create(user)


    frontend_url = (
        f"{settings.FRONTEND_BASE_URL}/auth/callback"
        f"?authcode={exchange_code}"
    )

    return redirect(frontend_url)


@api_view(["POST"])
@permission_classes([AllowAny])
def social_auth(request):
    code = request.data.get("code")

    user = ExchangeService.consume(code)

    refresh = RefreshToken.for_user(user)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    })