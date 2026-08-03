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
