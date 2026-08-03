
from django.contrib import admin
from django.urls import path,include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/cli/',include('apps.cli.urls')),
    path('api/project/',include('apps.projects.urls')),
    path('api/user/',include('apps.users.urls')),

]
