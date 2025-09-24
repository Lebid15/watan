from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Set/reset a user's password by username or email"

    def add_arguments(self, parser):
        parser.add_argument('--username', required=False)
        parser.add_argument('--email', required=False)
        parser.add_argument('--password', required=True)

    def handle(self, *args, **opts):
        username = (opts.get('username') or '').strip()
        email = (opts.get('email') or '').strip()
        if not username and not email:
            self.stderr.write('Provide --username or --email')
            return
        User = get_user_model()
        try:
            if username:
                u = User.objects.get(username=username)
            else:
                u = User.objects.get(email=email)
        except User.DoesNotExist:
            self.stderr.write('User not found')
            return
        u.set_password(opts['password'])
        u.save(update_fields=['password'])
        self.stdout.write(f"OK: password updated for {u.username}")
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = "Set password for a user by username"

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--password', required=True)

    def handle(self, *args, **opts):
        User = get_user_model()
        try:
            u = User.objects.get(username=opts['username'])
        except User.DoesNotExist:
            raise CommandError('User not found')
        u.set_password(opts['password'])
        u.save(update_fields=['password'])
        self.stdout.write(self.style.SUCCESS('Password updated'))
