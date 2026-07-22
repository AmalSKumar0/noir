import secrets

from apps.accounts.redis import redis_client
from django.contrib.auth.models import User


class ExchangeService:

    TTL = 60

    @staticmethod
    def create(user: User) -> str:
        code = secrets.token_urlsafe(32)

        redis_client.setex(
            f"oauth:{code}",
            ExchangeService.TTL,
            user.id,
        )

        return code

    @staticmethod
    def consume(code: str) -> User | None:
        key = f"oauth:{code}"

        user_id = redis_client.get(key)

        if not user_id:
            return None

        redis_client.delete(key)

        return User.objects.get(id=int(user_id))