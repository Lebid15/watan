from __future__ import annotations

from rest_framework.permissions import BasePermission


class RequireAdminRole(BasePermission):
    """
    Allow only users with elevated roles to access admin endpoints.
    Accepted roles: developer, instance_owner, distributor (optional)
    """

    allowed_roles = {"developer", "instance_owner", "distributor", "admin"}

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        role = getattr(user, 'role', None)
        return (role or '') in self.allowed_roles or getattr(user, 'is_superuser', False)


class RequireDeveloperRole(BasePermission):
    """
    Allow only developer (or superuser) for dev/ops endpoints.
    """

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        role = getattr(user, 'role', None)
        return (role or '') == 'developer' or getattr(user, 'is_superuser', False)
