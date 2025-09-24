from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
import secrets


class Command(BaseCommand):
    help = "Ensure a local admin user exists with an API token; prints the token"

    def add_arguments(self, parser):
        parser.add_argument('--username', default='admin')
        parser.add_argument('--email', default='admin@example.com')
        parser.add_argument('--password', default='admin123')
        parser.add_argument('--role', default='developer')

    def handle(self, *args, **opts):
        User = get_user_model()
        username = opts['username']
        email = opts['email']
        password = opts['password']
        role = opts['role']
        u, created = User.objects.get_or_create(username=username, defaults={
            'email': email,
            'is_staff': True,
            'is_superuser': True,
            'role': role,
        })
        if created:
            u.set_password(password)
            u.save()
        if not u.api_token:
            u.api_token = secrets.token_hex(24)
            u.save(update_fields=['api_token'])
        self.stdout.write(f"USERNAME={u.username}")
        self.stdout.write(f"API_TOKEN={u.api_token}")
