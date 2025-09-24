from __future__ import annotations

from rest_framework import serializers
from .models import Payout


class PayoutListItemSerializer(serializers.ModelSerializer):
    userId = serializers.UUIDField(source='user_id')
    createdAt = serializers.DateTimeField(source='created_at')
    sentAt = serializers.DateTimeField(source='sent_at', allow_null=True)
    completedAt = serializers.DateTimeField(source='completed_at', allow_null=True)

    class Meta:
        model = Payout
        fields = ('id','status','amount','currency','userId','external_ref','createdAt','sentAt','completedAt')


class AdminPayoutListItemSerializer(PayoutListItemSerializer):
    notesCount = serializers.IntegerField(source='notes_count', allow_null=True)
    manualNote = serializers.CharField(source='manual_note', allow_null=True)

    class Meta(PayoutListItemSerializer.Meta):
        fields = PayoutListItemSerializer.Meta.fields + ('notesCount','manualNote')


class PayoutDetailsSerializer(PayoutListItemSerializer):
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)
    manualNote = serializers.CharField(source='manual_note', allow_null=True)

    class Meta(PayoutListItemSerializer.Meta):
        fields = PayoutListItemSerializer.Meta.fields + ('notes','manualNote')


# OpenAPI helpers
class PageInfoSerializer(serializers.Serializer):
    nextCursor = serializers.CharField(allow_null=True)
    hasMore = serializers.BooleanField()


class PayoutsListResponseSerializer(serializers.Serializer):
    items = PayoutListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class AdminPayoutsListResponseSerializer(serializers.Serializer):
    items = AdminPayoutListItemSerializer(many=True)
    pageInfo = PageInfoSerializer()


class AdminPayoutActionRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=['approved','rejected','sent'])
    note = serializers.CharField(required=False, allow_blank=True)


class AdminPayoutActionResponseSerializer(serializers.Serializer):
    ok = serializers.BooleanField()
    id = serializers.UUIDField()
    status = serializers.CharField()


class AdminPayoutNotesResponseSerializer(serializers.Serializer):
    payoutId = serializers.UUIDField()
    notes = serializers.ListField(child=serializers.DictField(), allow_empty=True)