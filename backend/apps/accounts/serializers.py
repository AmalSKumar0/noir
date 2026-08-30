from apps.accounts.models import User, CompanyProfile, CompanyDeveloperRequest, Notification, DeveloperTeam
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed

class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = [
            "id",
            "company_name",
            "logo",
            "status",
            "industry",
            "company_size",
            "website",
            "tax_id",
            "phone_number",
            "created_at",
        ]


class AdminCompanyProfileSerializer(serializers.ModelSerializer):

    user_id = serializers.ReadOnlyField(source="user.id")
    user_email = serializers.ReadOnlyField(source="user.email")
    user_first_name = serializers.ReadOnlyField(source="user.first_name")
    user_last_name = serializers.ReadOnlyField(source="user.last_name")

    class Meta:
        model = CompanyProfile
        fields = [
            "id",
            "user_id",
            "user_email",
            "user_first_name",
            "user_last_name",
            "company_name",
            "logo",
            "status",
            "industry",
            "company_size",
            "website",
            "tax_id",
            "phone_number",
            "created_at",
            "updated_at",
        ]



class DeveloperUserSerializer(serializers.ModelSerializer):
    company_name = serializers.ReadOnlyField(source="company.company_name")

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "company", "company_name"]


class CompanyDeveloperRequestSerializer(serializers.ModelSerializer):
    company_id = serializers.ReadOnlyField(source="company.id")
    company_name = serializers.ReadOnlyField(source="company.company_name")
    company_logo = serializers.ReadOnlyField(source="company.logo")
    company_industry = serializers.ReadOnlyField(source="company.industry")
    developer_id = serializers.ReadOnlyField(source="developer.id")
    developer_username = serializers.ReadOnlyField(source="developer.username")
    developer_email = serializers.ReadOnlyField(source="developer.email")
    developer_first_name = serializers.ReadOnlyField(source="developer.first_name")
    developer_last_name = serializers.ReadOnlyField(source="developer.last_name")

    class Meta:
        model = CompanyDeveloperRequest
        fields = [
            "id",
            "company_id",
            "company_name",
            "company_logo",
            "company_industry",
            "developer_id",
            "developer_username",
            "developer_email",
            "developer_first_name",
            "developer_last_name",
            "status",
            "message",
            "created_at",
            "updated_at",
        ]


class NotificationSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.username", read_only=True, default=None)

    class Meta:
        model = Notification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "is_read",
            "link",
            "created_at",
            "sender_name",
        ]


class DeveloperTeamSerializer(serializers.ModelSerializer):
    members = DeveloperUserSerializer(many=True, read_only=True)
    member_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    project_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False)
    projects_data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DeveloperTeam
        fields = [
            "id",
            "name",
            "description",
            "company",
            "members",
            "member_ids",
            "project_ids",
            "projects_data",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["company"]

    def get_projects_data(self, obj):
        return [
            {
                "id": p.id,
                "title": p.title,
                "architecture": p.architecture,
                "status": p.status,
                "connection_code": p.connection_code,
            }
            for p in obj.projects.all()
        ]


class RegisterSerializer(serializers.ModelSerializer):
    role = serializers.CharField(required=False, default=User.Role.DEVELOPER)

    class Meta:
        model = User
        fields = ["username", "email", "password", "first_name", "last_name", "role"]
        extra_kwargs = {
            "password": {"write_only": True}
        }

    def create(self, validated_data):
        # Standard registration must always create DEVELOPER accounts.
        # Company accounts must register through CompanyRegisterView which creates CompanyProfile.
        validated_data.pop("role", None)
        validated_data["role"] = User.Role.DEVELOPER
        user = User.objects.create_user(**validated_data)
        return user


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields.pop(self.username_field, None)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Ensure role claim in JWT reflects valid status
        effective_role = "admin" if user.is_superuser else (
            user.role if (user.role != User.Role.COMPANY or hasattr(user, "company_profile")) else User.Role.DEVELOPER
        )
        token["role"] = effective_role
        token["email"] = user.email
        return token

    def validate(self, attrs):
        email = attrs.get("email")
        
        try:
            user = User.objects.get(email=email)

        except User.DoesNotExist:
            raise AuthenticationFailed("No active account found with the given credentials", code="authorization")
            
        attrs[self.username_field] = user.username

        data = super().validate(attrs)

        # Self-heal orphaned company role without CompanyProfile
        if user.role == User.Role.COMPANY and not hasattr(user, "company_profile"):
            user.role = User.Role.DEVELOPER
            user.save(update_fields=["role"])

        company_data = None
        if hasattr(user, "company_profile"):
            company_data = CompanyProfileSerializer(user.company_profile).data

        developer_company_data = None
        if user.company:
            developer_company_data = CompanyProfileSerializer(user.company).data

        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": "admin" if user.is_superuser else user.role,
            "company_profile": company_data,
            "company": developer_company_data,
        }
        return data