import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model
from apps.projects.views import get_project_with_permission

User = get_user_model()


@database_sync_to_async
def authenticate_user_from_token(token_str):
    if not token_str:
        return None
    try:
        access_token = AccessToken(token_str)
        user_id = access_token.payload.get("user_id")
        return User.objects.filter(id=user_id).first()
    except Exception:
        return None


@database_sync_to_async
def verify_project_access(project_code, user):
    if not user or not user.is_authenticated:
        return False
    project, err = get_project_with_permission(project_code, user)
    return project is not None


class ProjectLogsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        raw_code = self.scope['url_route']['kwargs'].get('project_code', 'default')
        self.project_code = raw_code.upper()

        # Extract JWT from query string
        query_string = self.scope.get('query_string', b'').decode('utf-8')
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]

        # Authenticate user from scope or token
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            user = await authenticate_user_from_token(token)

        if not user or not user.is_authenticated:
            await self.close(code=4003)
            return

        has_access = await verify_project_access(self.project_code, user)
        if not has_access:
            await self.close(code=4003)
            return

        self.group_upper = f'project_{self.project_code}'
        self.group_lower = f'project_{raw_code.lower()}'
        self.room_group_name = self.group_upper

        await self.channel_layer.group_add(self.group_upper, self.channel_name)
        await self.channel_layer.group_add(self.group_lower, self.channel_name)

        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_upper'):
            await self.channel_layer.group_discard(self.group_upper, self.channel_name)
        if hasattr(self, 'group_lower'):
            await self.channel_layer.group_discard(self.group_lower, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            data = json.loads(text_data)
        except Exception:
            data = {"log": text_data, "stream": "stdout"}

        data['project_code'] = self.project_code

        target_group = getattr(self, 'room_group_name', self.group_upper)
        await self.channel_layer.group_send(
            target_group,
            {
                'type': 'log_message',
                'data': data
            }
        )

    async def log_message(self, event):
        data = event['data']
        await self.send(text_data=json.dumps(data))

    async def injection_event(self, event):
        data = event['data']
        await self.send(text_data=json.dumps(data))


