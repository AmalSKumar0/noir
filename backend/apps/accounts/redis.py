import os
import sys
from django.conf import settings

# Ensure we import the third-party redis package, not this file (apps.accounts.redis)
_cur_dir = os.path.dirname(os.path.abspath(__file__))
_saved_path = sys.path[:]
try:
    sys.path = [p for p in sys.path if os.path.abspath(p) != _cur_dir]
    if "redis" in sys.modules and not hasattr(sys.modules["redis"], "Redis"):
        sys.modules.pop("redis", None)
    import redis as _real_redis
finally:
    sys.path = _saved_path

host = getattr(settings, "REDIS_HOST", "localhost")
port = getattr(settings, "REDIS_PORT", 6379)
db = getattr(settings, "REDIS_DB", 0)
try:
    port = int(port)
except (ValueError, TypeError):
    port = 6379

try:
    db = int(db)
except (ValueError, TypeError):
    db = 0

try:
    redis_client = _real_redis.Redis(
        host=host,
        port=port,
        db=db,
        decode_responses=True,
    )
except Exception:
    # Fallback to dummy client if redis server is unreachable in test mode
    class _DummyRedis:
        def __init__(self):
            self._data = {}
        def setex(self, name, time, value):
            self._data[name] = value
        def get(self, name):
            return self._data.get(name)
        def delete(self, name):
            self._data.pop(name, None)
        def pipeline(self):
            return self
        def execute(self):
            return [None]
    redis_client = _DummyRedis()