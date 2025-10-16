from __future__ import annotations

from rest_framework import serializers

from .models import CapitalAdjustment


class MoneyTotalSerializer(serializers.Serializer):
    currency = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=6)


class SectionTotalsSerializer(serializers.Serializer):
    totalCount = serializers.IntegerField()
    totals = MoneyTotalSerializer(many=True)


class OverviewResponseSerializer(serializers.Serializer):
    orders = SectionTotalsSerializer()
    deposits = SectionTotalsSerializer()
    payouts = SectionTotalsSerializer()


class DailyBucketSerializer(serializers.Serializer):
    date = serializers.DateField()
    count = serializers.IntegerField()
    totals = MoneyTotalSerializer(many=True)


class DailyResponseSerializer(serializers.Serializer):
    items = DailyBucketSerializer(many=True)


class CapitalAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapitalAdjustment
        fields = ('id', 'label', 'currency', 'amount', 'note', 'created_at', 'updated_at')


class CapitalAdjustmentInputSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=120)
    amount = serializers.DecimalField(max_digits=18, decimal_places=6)
    currency = serializers.CharField(max_length=12)
    note = serializers.CharField(max_length=255, allow_blank=True, required=False)