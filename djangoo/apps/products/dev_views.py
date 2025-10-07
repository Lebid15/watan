from __future__ import annotations

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from django.core.management import call_command
from apps.users.permissions import RequireDeveloperRole


class SeedGlobalProductsView(APIView):
    permission_classes = [IsAuthenticated, RequireDeveloperRole]

    def post(self, request):
        if not settings.DEBUG:
            # Avoid exposing seeding in production environments
            raise PermissionDenied('Seeding is disabled in production')
        call_command('seed_global_products')
        return Response({ 'message': 'Global products seeded (if empty)' })
