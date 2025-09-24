from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Update integration connection params"

    def add_arguments(self, parser):
        parser.add_argument('--id', required=True)
        parser.add_argument('--base-url')
        parser.add_argument('--api-token')
        parser.add_argument('--kod')
        parser.add_argument('--sifre')
        parser.add_argument('--enabled', choices=['true','false'])

    def handle(self, *args, **opts):
        sets = []
        params = []
        mapping = {
            'base-url': '"baseUrl"',
            'api-token': '"apiToken"',
            'kod': 'kod',
            'sifre': 'sifre',
        }
        for k, col in mapping.items():
            if opts.get(k.replace('-', '_')) is not None:
                sets.append(f"{col}=%s"); params.append(opts[k.replace('-', '_')])
        if opts.get('enabled') is not None:
            val = True if opts['enabled'].lower() == 'true' else False
            sets.append('enabled=%s'); params.append(val)
        if not sets:
            raise CommandError('No fields to update')
        params.append(opts['id'])
        with connection.cursor() as c:
            c.execute(f"UPDATE integrations SET {', '.join(sets)} WHERE id=%s", params)
        self.stdout.write(self.style.SUCCESS('Updated'))
