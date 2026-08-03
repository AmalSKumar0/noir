from django.shortcuts import render,redirect
from django.contrib.auth import authenticate, login, logout
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer, EmailTokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes,throttle_classes
from django.contrib.auth import get_user_model
from .models import SocialAuth
from rest_framework_simplejwt.exceptions import TokenError
from .services.google import GoogleOAuthService
from .services.exchange import ExchangeService
from .services.github import GithubOAuthService

from .throttles import LoginThrottle,RegisterThrottle

import requests
import secrets

User = get_user_model()

class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data["email"]

        user = User.objects.filter(email=email).first()

        if user:

            if SocialAuth.objects.filter(
                user=user,
                provider=SocialAuth.Type.PASSWORD
            ).exists():

                return Response(
                    {
                        "detail": "User already has password login."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user.set_password(serializer.validated_data["password"])
            user.save()

            SocialAuth.objects.create(
                user=user,
                provider=SocialAuth.Type.PASSWORD,
            )

            return Response(
                {"message": "Password login linked."},
                status=status.HTTP_200_OK,
            )

        user = serializer.save()

        SocialAuth.objects.create(
            user=user,
            provider=SocialAuth.Type.PASSWORD,
        )

        return Response(
            UserSerializer(user).data,
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        
        refresh_token = request.data["refresh"]

        if not refresh_token:
            return Response(
                {"error": "Refresh token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response(
                {"message": "Logged out successfully"},
                status=status.HTTP_205_RESET_CONTENT,
            )

        except TokenError:
            return Response(
                {"error": "Invalid or expired refresh token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]


@throttle_classes([LoginThrottle])
def github_login(request):
    client = request.GET.get("client")
    github_client_id = settings.GITHUB_CLIENT_ID
    redirect_uri = settings.BACKEND_BASE_URL
    scope = "read:user user:email"
    response_type = "code"
    
    auth_url = (
        f"https://github.com/login/oauth/authorize?"
        f"client_id={github_client_id}&"
        f"redirect_uri={redirect_uri}/api/accounts/github/login/callback/&"
        f"scope={scope}&"
        f"response_type={response_type}&"
        f"state={client}"
    )
    print(f"Redirecting to GitHub OAuth2 URL: {auth_url}")

    return redirect(auth_url)

def github_callback(request):
    code = request.GET.get("code")
    client = request.GET.get("state")

    if not code:
        return redirect(f"{settings.FRONTEND_BASE_URL}/login?error=no_code")
    
    user = GithubOAuthService.authenticate(code)

    exchange_code = ExchangeService.create(user)


    if client == "frontend":
        url = (f"{settings.FRONTEND_BASE_URL}/auth/callback")
    else:
        url = "http://127.0.0.1:53145/auth/callback"
    
    url = (
        f"{url}?authcode={exchange_code}"
    )

    return redirect(url)

@throttle_classes([LoginThrottle])
def google_login(request):
    google_client_id = settings.GOOGLE_CLIENT_ID
    redirect_uri = settings.BACKEND_BASE_URL
    scope = "openid email profile"
    response_type = "code"
    client = request.GET.get("client")

    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={google_client_id}&"
        f"redirect_uri={redirect_uri}/api/accounts/google/login/callback/&"
        f"scope={scope}&"
        f"response_type={response_type}&"
        f"state={client}"
    )

    return redirect(auth_url)


def google_callback(request):
    code = request.GET.get("code")

    client = request.GET.get("state")

    if not code:
        return redirect(f"{settings.FRONTEND_BASE_URL}/login?error=no_code")
    
    user = GoogleOAuthService.authenticate(code)

    exchange_code = ExchangeService.create(user)


    if client == "frontend":
        url = (f"{settings.FRONTEND_BASE_URL}/auth/callback")
    else:
        url = "http://127.0.0.1:53145/auth/callback"
    
    url = (
        f"{url}?authcode={exchange_code}"
    )

    return redirect(url)



@api_view(["POST"])
@permission_classes([AllowAny])
def social_auth(request):
    code = request.data.get("code")

    user = ExchangeService.consume(code)

    refresh = RefreshToken.for_user(user)

    userdata = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": "admin" if user.is_superuser else user.role,
        }

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user" : userdata
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whoami(request):
    user = request.user

    return Response({
        "id": user.id,
        "email": user.email,
        "name": user.username,
    })