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

from services.google import GoogleOAuthService
from services.exchange import ExchangeService

import requests

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




User = get_user_model()


#login using Github OAuth2
@api_view(["POST"])
@permission_classes([AllowAny])
def github_callback(request):
    code = request.data.get("code")

    if not code:
        return Response(
            {"error": "No code provided"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    session = requests.Session()
    session.headers.update({"Accept": "application/json"})

    try:
        # Exchange authorization code for access token
        token_response = session.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            timeout=10,
        )

        token_response.raise_for_status()

        access_token = token_response.json().get("access_token")

        if not access_token:
            return Response(
                {"error": "GitHub authentication failed"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        auth_headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
        }

        # Fetch profile
        user_response = session.get(
            "https://api.github.com/user",
            headers=auth_headers,
            timeout=10,
        )

        user_response.raise_for_status()

        github_user = user_response.json()

        # Use email from profile if available
        email = github_user.get("email")

        # Only call /emails when necessary
        if not email:
            emails_response = session.get(
                "https://api.github.com/user/emails",
                headers=auth_headers,
                timeout=10,
            )

            emails_response.raise_for_status()

            emails = emails_response.json()

            if isinstance(emails, list):
                primary = next(
                    (
                        e["email"]
                        for e in emails
                        if e.get("primary") and e.get("verified")
                    ),
                    None,
                )

                email = primary or (
                    emails[0]["email"] if emails else None
                )

        if not email:
            return Response(
                {"error": "No verified email found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        github_username = github_user["login"]

        full_name = github_user.get("name") or ""
        parts = full_name.split(" ", 1)

        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        user = User.objects.filter(email=email).first()

        if user is None:
            username = github_username

            while User.objects.filter(username=username).exists():
                username = f"{github_username}_{uuid.uuid4().hex[:6]}"

            user = User.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
            )

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        )

    except requests.RequestException:
        return Response(
            {"error": "Unable to communicate with GitHub"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    except Exception as e:
        return Response(
            {"error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

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
        return redirect("http://localhost:5173/login?error=no_code")
    
    user = GoogleOAuthService.authenticate(code)
    # refresh = RefreshToken.for_user(user)

    exchange_code = ExchangeService.create(user)


    frontend_url = (
        "http://localhost:5173/auth/callback"
        f"?authcode={exchange_code}"
    )

    return redirect(frontend_url)


def common_social_auth(request):
    code = request.POST.get("code")
    user = ExchangeService.consume(code)
    refresh = RefreshToken.for_user(user)

    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
    )
    