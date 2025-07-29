from rest_framework import serializers
from .models import CustomUser
from rest_framework_simplejwt.tokens import RefreshToken
from .models import PriceGroup
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Currency



# ✅ Serializer لتسجيل المستخدم
class RegisterSerializer(serializers.ModelSerializer):
    confirm = serializers.CharField(write_only=True)
    currency = serializers.PrimaryKeyRelatedField(queryset=Currency.objects.all(), required=False)

    class Meta:
        model = CustomUser
        fields = ['name', 'email', 'password', 'confirm', 'phone', 'country_code', 'currency']
        extra_kwargs = {'password': {'write_only': True}}

    def validate(self, data):
        if data['password'] != data['confirm']:
            raise serializers.ValidationError("كلمتا المرور غير متطابقتين.")
        return data

    def create(self, validated_data):
        validated_data.pop('confirm')  # نحذف تأكيد كلمة المرور
        return CustomUser.objects.create_user(**validated_data)

# ✅ Serializer لعرض بيانات المستخدم
class UserSerializer(serializers.ModelSerializer):
    token = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'email',
            'name',
            'phone',
            'country_code',
            'balance',
            'api_token',  # ← التوكن الثابت
            'token',      # ← توكنات JWT
        ]

    def get_token(self, user):
        refresh = RefreshToken.for_user(user)
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

class PriceGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceGroup
        fields = '__all__'
        

class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        return token

    def validate(self, attrs):
        # 👇 إعادة تسمية email إلى username ليستعملها SimpleJWT
        attrs['username'] = attrs.get('email')
        return super().validate(attrs)
    

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = '__all__'
