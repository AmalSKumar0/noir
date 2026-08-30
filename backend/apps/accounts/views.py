from django.shortcuts import render,redirect
from django.contrib.auth import authenticate, login, logout
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializers import RegisterSerializer, EmailTokenObtainPairSerializer
from apps.users.serializers import UserSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated,AllowAny
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes,throttle_classes
from django.contrib.auth import get_user_model
from .models import SocialAuth, CompanyProfile

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

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CompanyRegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        data = request.data
        email = data.get("email")
        username = data.get("username") or (email.split("@")[0] if email else "")
        password = data.get("password")
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")

        company_name = data.get("company_name")
        logo = data.get("logo", "")
        industry = data.get("industry", "")
        company_size = data.get("company_size", "")
        website = data.get("website", "")
        tax_id = data.get("tax_id", "")
        phone_number = data.get("phone_number", "")

        if not email or not password or not company_name:
            return Response(
                {"detail": "Email, password, and company name are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(email=email).exists():
            return Response(
                {"detail": "An account with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ensure unique username
        base_username = username or "company_user"
        final_username = base_username
        counter = 1
        while User.objects.filter(username=final_username).exists():
            final_username = f"{base_username}_{counter}"
            counter += 1

        user = User.objects.create_user(
            username=final_username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.COMPANY,
        )

        SocialAuth.objects.create(
            user=user,
            provider=SocialAuth.Type.PASSWORD,
        )

        from .models import CompanyProfile
        company_profile = CompanyProfile.objects.create(
            user=user,
            company_name=company_name,
            logo=logo,
            industry=industry,
            company_size=company_size,
            website=website,
            tax_id=tax_id,
            phone_number=phone_number,
        )

        refresh = RefreshToken.for_user(user)

        from .serializers import CompanyProfileSerializer
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "company_profile": CompanyProfileSerializer(company_profile).data,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class CompanyMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        from .models import CompanyProfile
        from .serializers import CompanyProfileSerializer
        try:
            profile = user.company_profile
            profile_data = CompanyProfileSerializer(profile).data
        except CompanyProfile.DoesNotExist:
            profile_data = None

        return Response({
            "user_id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "company_profile": profile_data,
        })

    def patch(self, request):
        user = request.user
        from .models import CompanyProfile
        from .serializers import CompanyProfileSerializer
        try:
            profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = CompanyProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


from rest_framework.generics import ListAPIView, RetrieveUpdateDestroyAPIView
from apps.users.permissions import IsAdmin
from core.pagination import DefaultPagination

class AdminCompanyListView(ListAPIView):
    queryset = CompanyProfile.objects.all().order_by("-created_at")
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = DefaultPagination

    def get_serializer_class(self):
        from .serializers import AdminCompanyProfileSerializer
        return AdminCompanyProfileSerializer

class AdminCompanyDetailView(RetrieveUpdateDestroyAPIView):
    queryset = CompanyProfile.objects.all()
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_serializer_class(self):
        from .serializers import AdminCompanyProfileSerializer
        return AdminCompanyProfileSerializer

    def delete(self, request, *args, **kwargs):
        company = self.get_object()
        user = company.user
        company.delete()
        user.delete()
        return Response({"message": "Company deleted successfully."}, status=status.HTTP_200_OK)




class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        
        refresh_token = request.data.get("refresh")

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
    if not code:
        return Response({"detail": "Authorization code is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = ExchangeService.consume(code)
    if not user:
        return Response({"detail": "Invalid or expired authorization code."}, status=status.HTTP_400_BAD_REQUEST)

    # Self-heal orphaned company role without CompanyProfile
    if user.role == User.Role.COMPANY and not hasattr(user, "company_profile"):
        user.role = User.Role.DEVELOPER
        user.save(update_fields=["role"])

    refresh = RefreshToken.for_user(user)

    company_data = None
    if hasattr(user, "company_profile"):
        from .serializers import CompanyProfileSerializer
        company_data = CompanyProfileSerializer(user.company_profile).data

    developer_company_data = None
    if user.company:
        from .serializers import CompanyProfileSerializer
        developer_company_data = CompanyProfileSerializer(user.company).data

    userdata = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": "admin" if user.is_superuser else user.role,
        "company_profile": company_data,
        "company": developer_company_data,
    }

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": userdata
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def whoami(request):
    user = request.user

    # Self-heal orphaned company role without CompanyProfile
    if user.role == User.Role.COMPANY and not hasattr(user, "company_profile"):
        user.role = User.Role.DEVELOPER
        user.save(update_fields=["role"])

    company_data = None
    if hasattr(user, "company_profile"):
        from .serializers import CompanyProfileSerializer
        company_data = CompanyProfileSerializer(user.company_profile).data
    
    developer_company_data = None
    if user.company:
        from .serializers import CompanyProfileSerializer
        developer_company_data = CompanyProfileSerializer(user.company).data

    return Response({
        "id": user.id,
        "email": user.email,
        "name": user.username,
        "role": "admin" if user.is_superuser else user.role,
        "company_profile": company_data,
        "company": developer_company_data,
    })


from django.db.models import Q
from .models import CompanyDeveloperRequest, Notification, DeveloperTeam
from .serializers import DeveloperUserSerializer, CompanyDeveloperRequestSerializer, NotificationSerializer, DeveloperTeamSerializer, CompanyProfileSerializer
from apps.projects.models import Project


def create_notification(recipient, title, message, notification_type, sender=None, link=""):
    try:
        Notification.objects.create(
            recipient=recipient,
            sender=sender,
            title=title,
            message=message,
            notification_type=notification_type,
            link=link
        )
    except Exception as e:
        print(f"Error creating notification: {e}")


class CompanyAvailableDevelopersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can access available developers."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        search = request.GET.get("search", "").strip()

        # Only select developers who do NOT belong to any company (company is null)
        queryset = User.objects.filter(role=User.Role.DEVELOPER, company__isnull=True)

        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) |
                Q(email__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        developers_data = DeveloperUserSerializer(queryset, many=True).data

        # Attach pending request status if existing
        sent_requests = CompanyDeveloperRequest.objects.filter(company=company_profile)
        sent_map = {req.developer_id: req for req in sent_requests}

        for dev in developers_data:
            dev_id = dev["id"]
            if dev_id in sent_map:
                dev["request_status"] = sent_map[dev_id].status
                dev["request_id"] = sent_map[dev_id].id
            else:
                dev["request_status"] = None
                dev["request_id"] = None

        return Response(developers_data)


class CompanyDeveloperRequestListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can view developer requests."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        requests = CompanyDeveloperRequest.objects.filter(company=company_profile).order_by("-created_at")
        serializer = CompanyDeveloperRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can send developer requests."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        developer_id = request.data.get("developer_id")
        message = request.data.get("message", "")

        if not developer_id:
            return Response({"detail": "Developer ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            developer = User.objects.get(id=developer_id, role=User.Role.DEVELOPER)
        except User.DoesNotExist:
            return Response({"detail": "Developer not found."}, status=status.HTTP_404_NOT_FOUND)

        if developer.company is not None:
            return Response({"detail": "This developer is already associated with a company."}, status=status.HTTP_400_BAD_REQUEST)

        # Check existing request
        existing = CompanyDeveloperRequest.objects.filter(company=company_profile, developer=developer).first()
        if existing:
            if existing.status == CompanyDeveloperRequest.Status.PENDING:
                return Response({"detail": "A pending request already exists for this developer."}, status=status.HTTP_400_BAD_REQUEST)
            elif existing.status == CompanyDeveloperRequest.Status.ACCEPTED:
                return Response({"detail": "This developer has already accepted your request."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Re-open rejected request as pending
                existing.status = CompanyDeveloperRequest.Status.PENDING
                existing.message = message
                existing.save()

                create_notification(
                    recipient=developer,
                    sender=user,
                    title=f"Invitation from {company_profile.company_name}",
                    message=f"{company_profile.company_name} sent you an invitation request to join their engineering team." + (f" Message: '{message}'" if message else ""),
                    notification_type=Notification.Type.COMPANY_INVITE,
                    link="/dashboard"
                )

                return Response(CompanyDeveloperRequestSerializer(existing).data, status=status.HTTP_200_OK)

        req_obj = CompanyDeveloperRequest.objects.create(
            company=company_profile,
            developer=developer,
            status=CompanyDeveloperRequest.Status.PENDING,
            message=message
        )

        create_notification(
            recipient=developer,
            sender=user,
            title=f"Invitation from {company_profile.company_name}",
            message=f"{company_profile.company_name} sent you an invitation request to join their engineering team." + (f" Message: '{message}'" if message else ""),
            notification_type=Notification.Type.COMPANY_INVITE,
            link="/dashboard"
        )

        return Response(CompanyDeveloperRequestSerializer(req_obj).data, status=status.HTTP_201_CREATED)


class CompanyDeveloperRequestCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can cancel requests."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            req_obj = CompanyDeveloperRequest.objects.get(pk=pk, company=company_profile)
        except CompanyDeveloperRequest.DoesNotExist:
            return Response({"detail": "Request not found."}, status=status.HTTP_404_NOT_FOUND)

        create_notification(
            recipient=req_obj.developer,
            sender=user,
            title="Invitation Request Cancelled",
            message=f"{company_profile.company_name} cancelled their pending invitation request.",
            notification_type=Notification.Type.COMPANY_CANCEL,
            link="/dashboard"
        )

        req_obj.delete()
        return Response({"message": "Request cancelled successfully."}, status=status.HTTP_200_OK)


class CompanyActiveDevelopersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can view active developers."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        devs = User.objects.filter(company=company_profile, role=User.Role.DEVELOPER)
        return Response(DeveloperUserSerializer(devs, many=True).data)

    def delete(self, request, pk):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can remove developers."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company_profile = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        try:
            dev = User.objects.get(pk=pk, company=company_profile)
        except User.DoesNotExist:
            return Response({"detail": "Developer not found in your organization."}, status=status.HTTP_404_NOT_FOUND)

        dev.company = None
        dev.save()

        create_notification(
            recipient=dev,
            sender=user,
            title="Removed from Organization",
            message=f"You have been removed from {company_profile.company_name}.",
            notification_type=Notification.Type.COMPANY_REMOVE,
            link="/dashboard"
        )

        return Response({"message": f"Developer {dev.username} removed from organization."}, status=status.HTTP_200_OK)


class DeveloperCompanyRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Role.DEVELOPER:
            return Response({"detail": "Only developers can view company requests."}, status=status.HTTP_403_FORBIDDEN)

        requests = CompanyDeveloperRequest.objects.filter(developer=user).order_by("-created_at")
        serializer = CompanyDeveloperRequestSerializer(requests, many=True)
        return Response(serializer.data)


class DeveloperRespondCompanyRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        if user.role != User.Role.DEVELOPER:
            return Response({"detail": "Only developers can respond to requests."}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get("action")  # 'accept' or 'reject'
        if action not in ["accept", "reject"]:
            return Response({"detail": "Action must be 'accept' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            req_obj = CompanyDeveloperRequest.objects.get(pk=pk, developer=user)
        except CompanyDeveloperRequest.DoesNotExist:
            return Response({"detail": "Request not found."}, status=status.HTTP_404_NOT_FOUND)

        if req_obj.status != CompanyDeveloperRequest.Status.PENDING:
            return Response({"detail": f"Request has already been {req_obj.status}."}, status=status.HTTP_400_BAD_REQUEST)

        if action == "accept":
            if user.company is not None:
                return Response({"detail": "You are already a member of a company."}, status=status.HTTP_400_BAD_REQUEST)

            user.company = req_obj.company
            user.save()

            req_obj.status = CompanyDeveloperRequest.Status.ACCEPTED
            req_obj.save()

            # Automatically mark all other pending requests as rejected
            CompanyDeveloperRequest.objects.filter(
                developer=user,
                status=CompanyDeveloperRequest.Status.PENDING
            ).exclude(pk=req_obj.pk).update(status=CompanyDeveloperRequest.Status.REJECTED)

            create_notification(
                recipient=req_obj.company.user,
                sender=user,
                title="Invitation Accepted",
                message=f"{user.username} ({user.email}) accepted your invitation and joined {req_obj.company.company_name}!",
                notification_type=Notification.Type.COMPANY_ACCEPT,
                link="/company/developers"
            )

            return Response({
                "message": f"Successfully joined {req_obj.company.company_name}!",
                "request": CompanyDeveloperRequestSerializer(req_obj).data
            })
        else:
            req_obj.status = CompanyDeveloperRequest.Status.REJECTED
            req_obj.save()

            create_notification(
                recipient=req_obj.company.user,
                sender=user,
                title="Invitation Declined",
                message=f"{user.username} ({user.email}) declined your invitation to join {req_obj.company.company_name}.",
                notification_type=Notification.Type.COMPANY_REJECT,
                link="/company/developers"
            )

            return Response({
                "message": "Request rejected.",
                "request": CompanyDeveloperRequestSerializer(req_obj).data
            })


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        queryset = Notification.objects.filter(recipient=user).order_by("-created_at")
        
        unread_only = request.GET.get("unread_only", "").lower() == "true"
        if unread_only:
            queryset = queryset.filter(is_read=False)

        unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
        serializer = NotificationSerializer(queryset, many=True)

        return Response({
            "unread_count": unread_count,
            "notifications": serializer.data
        })


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        user = request.user
        try:
            notification = Notification.objects.get(pk=pk, recipient=user)
            notification.is_read = True
            notification.save()
            return Response({"message": "Notification marked as read.", "id": pk})
        except Notification.DoesNotExist:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        Notification.objects.filter(recipient=user, is_read=False).update(is_read=True)
        return Response({"message": "All notifications marked as read."})


class NotificationDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        user = request.user
        try:
            notification = Notification.objects.get(pk=pk, recipient=user)
            notification.delete()
            return Response({"message": "Notification deleted successfully.", "id": pk})
        except Notification.DoesNotExist:
            return Response({"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND)


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        unread_count = Notification.objects.filter(recipient=user, is_read=False).count()
        return Response({"unread_count": unread_count})


class CompanyTeamListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == User.Role.COMPANY:
            try:
                company = user.company_profile
            except CompanyProfile.DoesNotExist:
                return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)
        elif user.role == User.Role.DEVELOPER and user.company:
            company = user.company
        else:
            return Response({"detail": "You must belong to a company to access teams."}, status=status.HTTP_403_FORBIDDEN)

        teams = DeveloperTeam.objects.filter(company=company)
        serializer = DeveloperTeamSerializer(teams, many=True)
        return Response(serializer.data)

    def post(self, request):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can create developer teams."}, status=status.HTTP_403_FORBIDDEN)

        try:
            company = user.company_profile
        except CompanyProfile.DoesNotExist:
            return Response({"detail": "Company profile not found."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get("name", "").strip()
        description = request.data.get("description", "").strip()
        member_ids = request.data.get("member_ids", [])
        project_ids = request.data.get("project_ids", [])

        if not name:
            return Response({"detail": "Team name is required."}, status=status.HTTP_400_BAD_REQUEST)

        team = DeveloperTeam.objects.create(
            company=company,
            name=name,
            description=description
        )

        if member_ids:
            members = User.objects.filter(id__in=member_ids, company=company, role=User.Role.DEVELOPER)
            team.members.set(members)
            for m in members:
                create_notification(
                    recipient=m,
                    sender=user,
                    title=f"Added to Team '{team.name}'",
                    message=f"You were added to the team '{team.name}' in {company.company_name}.",
                    notification_type=Notification.Type.SYSTEM,
                    link="/organization"
                )

        if project_ids:
            projects = Project.objects.filter(id__in=project_ids, owner=user)
            team.projects.set(projects)

        return Response(DeveloperTeamSerializer(team).data, status=status.HTTP_201_CREATED)


class CompanyTeamDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        try:
            team = DeveloperTeam.objects.get(pk=pk)
        except DeveloperTeam.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == User.Role.COMPANY and team.company.user != user:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if user.role == User.Role.DEVELOPER and user.company != team.company:
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        return Response(DeveloperTeamSerializer(team).data)

    def put(self, request, pk):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can edit teams."}, status=status.HTTP_403_FORBIDDEN)

        try:
            team = DeveloperTeam.objects.get(pk=pk, company=user.company_profile)
        except DeveloperTeam.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)

        name = request.data.get("name", team.name).strip()
        description = request.data.get("description", team.description).strip()
        member_ids = request.data.get("member_ids", None)
        project_ids = request.data.get("project_ids", None)

        team.name = name
        team.description = description
        team.save()

        if member_ids is not None:
            members = User.objects.filter(id__in=member_ids, company=user.company_profile, role=User.Role.DEVELOPER)
            new_members = set(members) - set(team.members.all())
            team.members.set(members)
            for m in new_members:
                create_notification(
                    recipient=m,
                    sender=user,
                    title=f"Added to Team '{team.name}'",
                    message=f"You were added to the team '{team.name}' in {user.company_profile.company_name}.",
                    notification_type=Notification.Type.SYSTEM,
                    link="/organization"
                )

        if project_ids is not None:
            projects = Project.objects.filter(id__in=project_ids, owner=user)
            team.projects.set(projects)

        return Response(DeveloperTeamSerializer(team).data)

    def delete(self, request, pk):
        user = request.user
        if user.role != User.Role.COMPANY:
            return Response({"detail": "Only company accounts can delete teams."}, status=status.HTTP_403_FORBIDDEN)

        try:
            team = DeveloperTeam.objects.get(pk=pk, company=user.company_profile)
            team.delete()
            return Response({"message": "Team deleted successfully."})
        except DeveloperTeam.DoesNotExist:
            return Response({"detail": "Team not found."}, status=status.HTTP_404_NOT_FOUND)


class DeveloperOrganizationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        company = None
        if user.role == User.Role.COMPANY and hasattr(user, "company_profile"):
            company = user.company_profile
        elif user.role == User.Role.DEVELOPER and user.company:
            company = user.company
        
        if not company:
            return Response({"detail": "User is not affiliated with any organization."}, status=status.HTTP_404_NOT_FOUND)

        company_data = CompanyProfileSerializer(company).data
        
        # Active devs roster
        active_devs = User.objects.filter(company=company, role=User.Role.DEVELOPER)
        active_devs_data = DeveloperUserSerializer(active_devs, many=True).data

        # Company Teams
        teams = DeveloperTeam.objects.filter(company=company)
        teams_data = DeveloperTeamSerializer(teams, many=True).data

        # Company Projects
        company_projects = Project.objects.filter(owner=company.user)
        projects_data = [
            {
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "architecture": p.architecture,
                "visibility": p.visibility,
                "analysis_mode": p.analysis_mode,
                "status": p.status,
                "connection_code": p.connection_code,
                "created_at": p.created_at,
                "assigned_teams": list(p.assigned_teams.filter(company=company).values_list('name', flat=True))
            }
            for p in company_projects
        ]

        return Response({
            "company": company_data,
            "active_devs": active_devs_data,
            "teams": teams_data,
            "projects": projects_data,
        })