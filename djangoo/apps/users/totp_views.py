from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import RequireAdminRole
from .totp_service import get_totp_service


class TotpSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        service = get_totp_service()
        label = request.data.get('label')
        tenant_id = getattr(request.user, 'tenant_id', None)
        result = service.generate_secret(request.user, tenant_id=tenant_id, label=label)
        return Response(
            {
                'secret': result.secret,
                'qrCode': result.qr_code,
                'backupCodes': result.backup_codes,
                'credentialId': result.credential_id,
            },
            status=status.HTTP_200_OK,
        )


class TotpVerifySetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        token = str(request.data.get('token') or '').strip()
        credential_id = request.data.get('credentialId')
        if not token or not credential_id:
            raise ValidationError('token and credentialId are required')
        service = get_totp_service()
        verified = service.verify_and_activate(request.user, token, credential_id)
        if not verified:
            raise ValidationError('رمز التحقق غير صحيح')
        return Response({'success': True})


class TotpVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        token = str(request.data.get('token') or '').strip()
        service = get_totp_service()
        verified = service.verify_token(request.user, token)
        return Response({'verified': verified})


class TotpStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        service = get_totp_service()
        enabled = service.has_totp_enabled(request.user)
        return Response({'enabled': enabled})


class TotpDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        service = get_totp_service()
        service.disable_totp(request.user)
        return Response({'success': True})


class TotpRegenerateCodesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        service = get_totp_service()
        codes = service.regenerate_recovery_codes(request.user)
        return Response({'codes': codes})


class TotpResetView(APIView):
    permission_classes = [IsAuthenticated, RequireAdminRole]

    def post(self, request, user_id: str, *args, **kwargs):
        service = get_totp_service()
        User = get_user_model()
        target = get_object_or_404(User, pk=user_id)
        service.reset_two_factor(target, request.user)
        return Response({'success': True})
