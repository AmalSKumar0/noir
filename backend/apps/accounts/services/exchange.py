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
            pipe = redis_client.pipeline()
            pipe.get(key)
            pipe.delete(key)
            results = pipe.execute()
            user_id = results[0]
            if not user_id:
                return None
            return User.objects.get(id=int(user_id))
        except (redis.RedisError, User.DoesNotExist, ValueError) as e:
            logger.error(f"Error consuming oauth code: {e}")
            return None