from django.conf import settings
from django.contrib.auth.models import User
import uuid
import requests


class GithubOAuthService:
    @classmethod
    def authenticate(cls, code: str) -> User:
        session = requests.Session()
        """
        Exchange GitHub's authorization code for an access token,
        fetch the user's profile, and return a Django User.
        """

        # Exchange authorization code for access token
        token_response = requests.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={
                "Accept": "application/json",
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

        return user