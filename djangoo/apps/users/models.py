from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class User(AbstractUser):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Active")
        SUSPENDED = "suspended", _("Suspended")
        DISABLED = "disabled", _("Disabled")

    class Roles(models.TextChoices):
        DEVELOPER = "developer", _("Developer")
        INSTANCE_OWNER = "instance_owner", _("Instance Owner")
        DISTRIBUTOR = "distributor", _("Distributor")
        END_USER = "end_user", _("End User")

    balance = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    currency = models.CharField(max_length=10, default="USD")
    api_token = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    overdraft = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.END_USER)

    class Meta:
        db_table = 'dj_users'

    def __str__(self):
        return self.username
