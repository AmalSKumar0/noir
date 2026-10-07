from django.urls import path
from apps.cli import views

urlpatterns = [
    path('install.sh', views.install_sh_view, name='cli_install_sh'),
    path('install.ps1', views.install_ps1_view, name='cli_install_ps1'),
    path('downloads/<str:filename>', views.download_binary_view, name='cli_download_binary'),
]
