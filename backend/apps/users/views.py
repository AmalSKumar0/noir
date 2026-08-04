from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from apps.users.permissions import IsAdmin
from apps.accounts.models import User
from .serializers import UserSerializer
from core.pagination import  DefaultPagination
from rest_framework.decorators import api_view, permission_classes,throttle_classes
from rest_framework.generics import RetrieveUpdateDestroyAPIView

from .throttles import UserListThrottle,UserDeleteThrottle


class UserListView(ListAPIView):
    queryset = User.objects.filter(is_superuser=False)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated,IsAdmin]
    pagination_class = DefaultPagination
    throttle_classes = [UserListThrottle]

class UserDetailView(RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_object(self):
        print(self.kwargs)
        return super().get_object()
    
    def get_throttles(self):
        if self.request.method == "DELETE":
            throttle_classes = [UserDeleteThrottle]
        else:
            throttle_classes = []

        return [throttle() for throttle in throttle_classes]

    