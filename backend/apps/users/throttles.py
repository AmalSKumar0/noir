from rest_framework.throttling import UserRateThrottle


class UserListThrottle(UserRateThrottle):
    scope = "user"

class UserDeleteThrottle(UserRateThrottle):
    scope = "user_delete"