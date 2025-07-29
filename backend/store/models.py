from django.db import models
from django.conf import settings
from django.utils.text import slugify

class Product(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.title)
            slug = base_slug
            counter = 1
            while Product.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            self.slug = slug
        super().save(*args, **kwargs)


class ProductPackage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='packages')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)  # ✅ سعر رأس المال
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.title} - {self.name}"


class ProductOrder(models.Model):
    STATUS_CHOICES = (
        ('pending', 'قيد الانتظار'),
        ('approved', 'مقبول'),
        ('rejected', 'مرفوض'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    package = models.ForeignKey(ProductPackage, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"طلب {self.user.email} - {self.package.name} ({self.status})"


class PackagePrice(models.Model):
    package = models.ForeignKey(ProductPackage, on_delete=models.CASCADE, related_name='prices')
    group = models.ForeignKey('accounts.PriceGroup', on_delete=models.CASCADE)
    price = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.package.name} - {self.group.name} = {self.price}"
