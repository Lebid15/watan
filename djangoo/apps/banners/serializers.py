from rest_framework import serializers
from .models import Banner


class BannerSerializer(serializers.ModelSerializer):
    """
    Serializer لصور السلايدر
    """
    
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Banner
        fields = [
            'id',
            'image',
            'image_url',
            'order',
            'is_active',
            'link',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_image_url(self, obj):
        """الحصول على URL الكامل للصورة"""
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None
