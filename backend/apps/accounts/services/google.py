from django.conf import settings
from django.contrib.auth.models import User

import requests


class GoogleOAuthService:

    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    @classmethod
    def authenticate(cls, code: str) -> User:
        """
        Exchange Google's authorization code for an access token,
        fetch the user's profile, and return a Django User.
        """

        # Exchange authorization code for access token
        token_response = requests.post(
            cls.TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
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

        # Create or retrieve Django user
        user, created = User.objects.get_or_create(
            username=email,
            defaults={
                "email": email,
                "first_name": profile.get("given_name", ""),
                "last_name": profile.get("family_name", ""),
            },
        )

        # Update profile fields if they've changed
        user.first_name = profile.get("given_name", "")
        user.last_name = profile.get("family_name", "")
        user.email = email
        user.save()

        return user