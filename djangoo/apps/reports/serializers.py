from __future__ import annotations

from rest_framework import serializers


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