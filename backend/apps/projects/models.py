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
    analysis_data = models.JSONField(default=dict, blank=True)

    detected_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.title} ({self.framework.name})"

    class Meta:
        ordering = ['-detected_at']


class TestRun(models.Model):
    class Status(models.TextChoices):
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"
        RUNNING = "running", "Running"
        ERROR = "error", "Error"

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="test_runs")
    executor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="executed_test_runs")
    team = models.ForeignKey('accounts.DeveloperTeam', on_delete=models.SET_NULL, null=True, blank=True, related_name="test_runs")
    suite_name = models.CharField(max_length=255, default="Default Integration Suite")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PASSED)
    command = models.CharField(max_length=255, default="npm test")
    total_tests = models.IntegerField(default=0)
    passed_tests = models.IntegerField(default=0)
    failed_tests = models.IntegerField(default=0)
    skipped_tests = models.IntegerField(default=0)
    duration_ms = models.IntegerField(default=0)
    logs = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"TestRun #{self.id} on {self.project.title} by {self.executor.username} ({self.status})"


        
