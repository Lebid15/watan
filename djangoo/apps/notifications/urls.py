from django.urls import path

from .views import (
    NotificationMarkAllReadView,
    NotificationMarkOneReadView,
    NotificationsAnnounceView,
    NotificationsMineView,
    NotificationsMyView,
    NotificationsRootView,
)

urlpatterns = [
    path("notifications/my", NotificationsMyView.as_view(), name="notifications-my"),
    path("notifications/my/", NotificationsMyView.as_view(), name="notifications-my-slash"),
    path("notifications/mine", NotificationsMineView.as_view(), name="notifications-mine"),
    path("notifications/mine/", NotificationsMineView.as_view(), name="notifications-mine-slash"),
    path("notifications", NotificationsRootView.as_view(), name="notifications-root"),
    path("notifications/", NotificationsRootView.as_view(), name="notifications-root-slash"),
    path("notifications/read-all", NotificationMarkAllReadView.as_view(), name="notifications-read-all"),
    path("notifications/read-all/", NotificationMarkAllReadView.as_view(), name="notifications-read-all-slash"),
    path("notifications/<uuid:pk>/read", NotificationMarkOneReadView.as_view(), name="notifications-read-one"),
    path("notifications/<uuid:pk>/read/", NotificationMarkOneReadView.as_view(), name="notifications-read-one-slash"),
    path("notifications/announce", NotificationsAnnounceView.as_view(), name="notifications-announce"),
    path("notifications/announce/", NotificationsAnnounceView.as_view(), name="notifications-announce-slash"),
]
