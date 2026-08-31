from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/project/(?P<project_code>[\w-]+)/logs/$', consumers.ProjectLogsConsumer.as_asgi()),
    re_path(r'^ws/project/(?P<project_code>[\w-]+)/$', consumers.ProjectLogsConsumer.as_asgi()),
]
