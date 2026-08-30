import secrets
import logging
import redis
from apps.accounts.redis import redis_client
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)


class ExchangeService:

    TTL = 60

    @staticmethod
    def create(user: User) -> str:
        code = secrets.token_urlsafe(32)

        try:
            redis_client.setex(
                f"oauth:{code}",
                ExchangeService.TTL,
                user.id,
            )
        except redis.RedisError as e:
            logger.error(f"Redis error setting oauth code: {e}")

        return code

    @staticmethod
    def consume(code: str) -> User | None:
        key = f"oauth:{code}"

        try:
            user_id = redis_client.get(key)
            if not user_id:
                return None
            redis_client.delete(key)
            return User.objects.get(id=int(user_id))
        except (redis.RedisError, User.DoesNotExist, ValueError) as e:
            logger.error(f"Error consuming oauth code: {e}")
            return None