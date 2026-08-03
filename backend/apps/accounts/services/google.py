from django.conf import settings
from django.contrib.auth import get_user_model
from apps.accounts.models import SocialAuth
import requests

User = get_user_model()

class GoogleOAuthService:

    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    @classmethod
    def authenticate(cls, code: str) -> User:
        """
        Exchange Google's authorization code for an access token,
        fetch the user's profile, and return a Django User.
        """
        redirect_uri = settings.BACKEND_BASE_URL

        # Exchange authorization code for access token
        token_response = requests.post(
            cls.TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{redirect_uri}/api/accounts/google/login/callback/",
                "grant_type": "authorization_code",
            },
            timeout=10,
        )

        token_response.raise_for_status()

        access_token = token_response.json()["access_token"]

        # Fetch Google profile
        profile_response = requests.get(
            cls.USERINFO_URL,
            headers={
                "Authorization": f"Bearer {access_token}"
            },
            timeout=10,
        )

        profile_response.raise_for_status()

        profile = profile_response.json()

        email = profile["email"]

        user = User.objects.filter(email=email).first()

        if user is None:
            username = email.split("@")[0]
            first_name = profile.get("given_name", "")
            last_name = profile.get("family_name", "")

            user = User.objects.create_user(
                email=email,
                username=username,
                first_name=first_name,
                last_name=last_name,
            )

        social = SocialAuth.objects.get_or_create(
            user=user,
            provider="google",
            provider_id=f"{profile['id']}"
        )

        user.social = social

        return user