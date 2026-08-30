from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Role(models.TextChoices):
        COMPANY = "company", "Company"
        DEVELOPER = "developer", "Developer"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        blank=True,
        default=Role.DEVELOPER
    )
    company = models.ForeignKey(
        'accounts.CompanyProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="developers"
    )

class SocialAuth(models.Model):
    class Type(models.TextChoices):
        GOOGLE = "google", "Google"
        GITHUB = "github", "Github"
        PASSWORD = "password", "Password"

    user = models.ForeignKey(User, on_delete=models.CASCADE,related_name="social_accounts")
    provider = models.CharField(max_length=8,choices=Type.choices,default=Type.PASSWORD)
    provider_id = models.CharField(max_length=255,blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class CompanyProfile(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="company_profile")
    company_name = models.CharField(max_length=255)
    logo = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    industry = models.CharField(max_length=100, blank=True, default="")
    company_size = models.CharField(max_length=50, blank=True, default="")
    website = models.URLField(max_length=255, blank=True, default="")
    tax_id = models.CharField(max_length=100, blank=True, default="")
    phone_number = models.CharField(max_length=50, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company_name} ({self.status})"


class CompanyDeveloperRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"

    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name="developer_requests")
    developer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="company_requests")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    message = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('company', 'developer')

    def __str__(self):
        return f"Request from {self.company.company_name} to {self.developer.username} ({self.status})"


class Notification(models.Model):
    class Type(models.TextChoices):
        COMPANY_INVITE = "company_invite", "Company Invitation"
        COMPANY_ACCEPT = "company_accept", "Invitation Accepted"
        COMPANY_REJECT = "company_reject", "Invitation Rejected"
        COMPANY_CANCEL = "company_cancel", "Invitation Cancelled"
        COMPANY_REMOVE = "company_remove", "Removed From Organization"
        SYSTEM = "system", "System Notification"

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="sent_notifications")
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=Type.choices, default=Type.SYSTEM)
    is_read = models.BooleanField(default=False)
    link = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.recipient.username}: {self.title} ({'Read' if self.is_read else 'Unread'})"


class DeveloperTeam(models.Model):
    company = models.ForeignKey(CompanyProfile, on_delete=models.CASCADE, related_name="teams")
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    members = models.ManyToManyField(User, related_name="developer_teams", blank=True)
    projects = models.ManyToManyField('projects.Project', related_name="assigned_teams", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.company.company_name}"





