from uuid import UUID
from django.db import connection

OLD_SHAMTECH_TENANT_ID = UUID('7d677574-21be-45f7-b520-22e0fe36b860')
NEW_SHAMTECH_TENANT_ID = UUID('fd0a6cce-f6e7-4c67-aa6c-a19fcac96536')
NEW_SHAMTECH_USER_ID = UUID('6111b38d-3ab7-41f1-bb8b-63d920b2cd32')  # legacy user "diana"


def run():
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            UPDATE product_orders
               SET "tenantId"=%s,
                   "userId"=%s
             WHERE "tenantId"=%s
               AND (mode='CHAIN_FORWARD' OR "providerId"='CHAIN_FORWARD')
            ''',
            [NEW_SHAMTECH_TENANT_ID, NEW_SHAMTECH_USER_ID, OLD_SHAMTECH_TENANT_ID],
        )
        moved = cursor.rowcount
        print(f"Migrated {moved} chain-forward orders to new ShamTech tenant")

    _remap_packages_and_products()
    _repair_player_identifiers()


def _remap_packages_and_products():
    """Ensure migrated orders reference the new ShamTech package/product IDs."""
    remapped = 0
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            SELECT po.id, po."packageId", pp."publicCode"
              FROM product_orders po
              JOIN product_packages pp ON pp.id = po."packageId"
             WHERE po."tenantId"=%s
               AND po.mode='CHAIN_FORWARD'
            ''',
            [NEW_SHAMTECH_TENANT_ID],
        )
        rows = cursor.fetchall()

        for order_id, old_package_id, public_code in rows:
            cursor.execute(
                '''
                SELECT id, product_id
                  FROM product_packages
                 WHERE "tenantId"=%s
                   AND "publicCode"=%s
                 LIMIT 1
                ''',
                [NEW_SHAMTECH_TENANT_ID, public_code],
            )
            match = cursor.fetchone()
            if not match:
                continue

            new_package_id, new_product_id = match
            if new_package_id == old_package_id:
                continue

            cursor.execute(
                '''
                UPDATE product_orders
                   SET "packageId"=%s,
                       "productId"=%s
                 WHERE id=%s
                ''',
                [new_package_id, new_product_id, order_id],
            )
            remapped += cursor.rowcount

    if remapped:
        print(f"Remapped {remapped} orders to new ShamTech package/product IDs")


def _repair_player_identifiers():
    """Restore player identifiers on forwarded orders when they were overwritten."""
    with connection.cursor() as cursor:
        cursor.execute(
            '''
            UPDATE product_orders
               SET "userIdentifier" = COALESCE(NULLIF("extraField", ''), "userIdentifier")
             WHERE "tenantId"=%s
               AND mode='CHAIN_FORWARD'
               AND ("userIdentifier" IS NULL OR "userIdentifier"='' OR "userIdentifier"='20')
            ''',
            [NEW_SHAMTECH_TENANT_ID],
        )
        if cursor.rowcount:
            print(f"Fixed user identifiers on {cursor.rowcount} forwarded orders")
