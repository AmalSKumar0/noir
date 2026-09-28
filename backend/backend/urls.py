
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


from django.conf import settings


def health_check(request):
    data = {"status": "healthy", "service": "noir-backend"}
    if request.GET.get("deep") == "1":
        # Check database connectivity
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            data["database"] = "connected"
        except Exception as e:
            data["database"] = f"error: {str(e)}"
            return JsonResponse(data, status=503)

        # Check redis/cache connectivity if configured
        if getattr(settings, 'REDIS_LOCATION', None):
            try:
                from django.core.cache import cache
                cache.set("__healthcheck__", 1, 5)
                data["cache"] = "connected" if cache.get("__healthcheck__") == 1 else "unavailable"
            except Exception as e:
                data["cache"] = f"error: {str(e)}"
                return JsonResponse(data, status=503)
    return JsonResponse(data)


urlpatterns = [
    path('health/', health_check, name='health_check'),
    path('api/health/', health_check, name='api_health_check'),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/cli/', include('apps.cli.urls')),
    path('api/project/', include('apps.projects.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/user/', include('apps.users.urls')),
]

