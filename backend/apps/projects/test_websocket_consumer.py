import json
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken
from apps.projects.models import Project
from apps.projects.routing import websocket_urlpatterns

User = get_user_model()


class ProjectLogsConsumerTests(TransactionTestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="ws_owner",
            email="ws_owner@noir.ai",
            password="Password123!",
        )
        self.other_user = User.objects.create_user(
            username="ws_other",
            email="ws_other@noir.ai",
            password="Password123!",
        )
        self.project = Project.objects.create(
            title="WebSocket Project",
            connection_code="WS-TEST1234",
            owner=self.owner,
            status=Project.Status.ACTIVE,
        )
        self.application = URLRouter(websocket_urlpatterns)

    async def test_unauthenticated_connection_rejected_code_4003(self):
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/project/{self.project.connection_code}/logs/",
        )
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4003)

    async def test_invalid_token_connection_rejected_code_4003(self):
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/project/{self.project.connection_code}/logs/?token=invalid_garbage_jwt",
        )
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4003)

    async def test_unauthorized_user_connection_rejected_code_4003(self):
        other_token = str(AccessToken.for_user(self.other_user))
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/project/{self.project.connection_code}/logs/?token={other_token}",
        )
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertEqual(close_code, 4003)

    async def test_authorized_owner_connection_accepted_and_receives_broadcast(self):
        owner_token = str(AccessToken.for_user(self.owner))
        communicator = WebsocketCommunicator(
            self.application,
            f"/ws/project/{self.project.connection_code}/logs/?token={owner_token}",
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send a log message through the consumer
        log_payload = {"log": "[CONTAINER] Injected CPU stress 4 workers", "stream": "stdout"}
        await communicator.send_to(text_data=json.dumps(log_payload))

        # Consumer broadcasts to group and sends back
        response = await communicator.receive_from()
        parsed = json.loads(response)
        self.assertEqual(parsed["log"], "[CONTAINER] Injected CPU stress 4 workers")
        self.assertEqual(parsed["project_code"], self.project.connection_code)

        await communicator.disconnect()
