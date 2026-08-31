import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ProjectLogsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        raw_code = self.scope['url_route']['kwargs'].get('project_code', 'default')
        self.project_code = raw_code.upper()
        self.group_upper = f'project_{self.project_code}'
        self.group_lower = f'project_{raw_code.lower()}'

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

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'log_message',
                'data': data
            }
        )

    async def log_message(self, event):
        data = event['data']
        await self.send(text_data=json.dumps(data))
