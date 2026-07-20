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
import requests
from rest_framework.decorators import api_view, permission_classes
from django.contrib.auth import get_user_model


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

@api_view(['POST'])
@permission_classes([AllowAny])
def github_callback(request):
    # Retrieve 'code' from JSON payload (request.data)
    code = request.data.get("code")
    if not code:
        return Response({"error": "No code provided from GitHub"}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Exchange code for access token
    token_url = "https://github.com/login/oauth/access_token"
    token_data = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "code": code
    }
    token_response = requests.post(token_url, data=token_data, headers={"Accept": "application/json"})
    access_token = token_response.json().get("access_token")

    if not access_token:
        return Response({"error": "Failed to retrieve access token"}, status=status.HTTP_400_BAD_REQUEST)

    # 2. Fetch GitHub User Profile info
    user_response = requests.get("https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})
    github_user = user_response.json()

    # 3. Fetch GitHub Emails
    emails_response = requests.get("https://api.github.com/user/emails", headers={"Authorization": f"Bearer {access_token}"})
    github_emails = emails_response.json()
    
    email = None
    if isinstance(github_emails, list):
        for email_obj in github_emails:
            if email_obj.get("primary") and email_obj.get("verified"):
                email = email_obj.get("email")
                break
        if not email and github_emails:
            email = github_emails[0].get("email")

    if not email:
        return Response({"error": "An email address is required from GitHub."}, status=status.HTTP_400_BAD_REQUEST)

    # 4. User Creation or Retrieval
    github_username = github_user.get("login")
    full_name = github_user.get("name") or ""
    name_parts = full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        if User.objects.filter(username=github_username).exists():
            github_username = f"{github_username}_{User.objects.count()}"
            
        user = User.objects.create(
            email=email,
            username=github_username,
            first_name=first_name,
            last_name=last_name
        )

    # 5. Generate SimpleJWT Tokens
    refresh = RefreshToken.for_user(user)

    # 6. Return JSON response to Frontend
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh)
    }, status=status.HTTP_200_OK)
