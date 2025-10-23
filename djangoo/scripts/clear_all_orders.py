from django.db import connection


TARGET_TABLES = (
    "order_dispatch_log",
    "product_orders",
)


def run():
    with connection.cursor() as cursor:
        for table in TARGET_TABLES:
            cursor.execute(f'DELETE FROM {table}')
            print(f"Deleted {cursor.rowcount} rows from {table}")
