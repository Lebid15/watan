from rest_framework import serializers
from .models import PriceGroup

class PriceGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceGroup
        fields = '__all__'
