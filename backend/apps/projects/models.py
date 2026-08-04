from django.db import models
from apps.accounts.models import User
from .services.generateCode import generate_code

class Framework(models.Model):
    name = models.CharField(max_length=50,unique=True)
    language = models.CharField(max_length=30)
    default_test_command = models.CharField(max_length=255)
    detection_file = models.CharField(max_length=100,help_text="File used to detect the framework (e.g. manage.py, artisan).")

    supported = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Project(models.Model):

    class DeploymentType(models.TextChoices):
        MONOLITH = "monolith", "Monolith"
        MICROSERVICE = "microservice", "Microservice"

    class Visibility(models.TextChoices):
        PRIVATE = "private", "Private"
        PUBLIC = "public", "Public"

    class AnalysisMode(models.TextChoices):
        MANUAL = "manual", "Manual"
        SCHEDULED = "scheduled", "Scheduled"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"
        COMPLETED = "completed", "Completed"

    # company = models.ForeignKey("companies.Company",on_delete=models.PROTECT,related_name="projects",)
    owner = models.ForeignKey(User, on_delete=models.CASCADE,related_name="projects")
    title = models.CharField(max_length=100)
    description = models.TextField()
    architecture = models.CharField(max_length=20,choices=DeploymentType.choices)
    visibility = models.CharField(max_length=10,choices=Visibility.choices,default=Visibility.PRIVATE)

    analysis_mode = models.CharField(max_length=10,choices=AnalysisMode.choices,default=AnalysisMode.MANUAL)
    status = models.CharField(max_length=10,choices=Status.choices,default=Status.ACTIVE,db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    connection_code = models.CharField(max_length=20,unique=True,editable=False,default=generate_code)

    def __str__(self):
        return self.title
    
    class Meta:
        ordering = ['-updated_at']


class ProjectProfile(models.Model):

    project = models.OneToOneField("projects.Project",on_delete=models.CASCADE,related_name="profile")
    framework = models.ForeignKey(Framework,on_delete=models.PROTECT,related_name="project_profiles")
    runtime_version = models.CharField(max_length=30,blank=True)
    package_manager = models.CharField(max_length=30,blank=True)
    operating_system = models.CharField(max_length=50)

    detected_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.title} ({self.framework.name})"

    class Meta:
        ordering = ['-detected_at']

        
