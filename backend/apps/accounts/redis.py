import os
import redis
from django.conf import settings

host=settings.REDIS_HOST
port=settings.REDIS_PORT
db=settings.REDIS_DB
try:
    port = int(port)
except (ValueError, TypeError):
    port = 6379

try:
    db = int(db)
except (ValueError, TypeError):
    db = 0

redis_client = redis.Redis(
    host=host,
    port=port,
    db=db,
    decode_responses=True,
)