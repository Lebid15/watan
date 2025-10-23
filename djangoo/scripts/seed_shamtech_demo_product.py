from uuid import uuid4, UUID
from decimal import Decimal
from django.db import connection

SHAMTECH_TENANT_ID = UUID('fd0a6cce-f6e7-4c67-aa6c-a19fcac96536')
SHAMTECH_PRICE_GROUP_ID = UUID('d8655757-600d-4cbb-b327-9337782587c6')


def _fetch_existing_ids(cursor):
    cursor.execute(
        "SELECT id FROM product WHERE \"tenantId\"=%s AND name=%s LIMIT 1",
        [SHAMTECH_TENANT_ID, 'Test PUBG 60'],
    )
    prod_row = cursor.fetchone()
    prod_id = prod_row[0] if prod_row else None

    cursor.execute(
        "SELECT id FROM product_packages WHERE \"tenantId\"=%s AND name=%s LIMIT 1",
        [SHAMTECH_TENANT_ID, 'PUBG Global 60'],
    )
    pkg_row = cursor.fetchone()
    pkg_id = pkg_row[0] if pkg_row else None

    price_id = None
    if pkg_id:
        cursor.execute(
            "SELECT id FROM package_prices WHERE \"tenantId\"=%s AND package_id=%s LIMIT 1",
            [SHAMTECH_TENANT_ID, pkg_id],
        )
        price_row = cursor.fetchone()
        price_id = price_row[0] if price_row else None
    return prod_id, pkg_id, price_id


def _ensure_demo_orders(cursor, product_id, package_id):
    cursor.execute(
        'SELECT id FROM users WHERE "tenantId"=%s LIMIT 5',
        [SHAMTECH_TENANT_ID],
    )
    user_rows = cursor.fetchall()
    if not user_rows:
        return []

    created_orders = []
    for (user_id,) in user_rows:
        cursor.execute(
            'SELECT 1 FROM product_orders WHERE "tenantId"=%s AND "userId"=%s LIMIT 1',
            [SHAMTECH_TENANT_ID, user_id],
        )
        if cursor.fetchone():
            continue

        cursor.execute(
            '''
            INSERT INTO product_orders (
                id,
                "tenantId",
                "orderNo",
                status,
                "userId",
                "productId",
                "packageId",
                quantity,
                "sellPriceCurrency",
                "sellPriceAmount",
                price,
                "createdAt",
                "externalStatus"
            )
            VALUES (
                gen_random_uuid(),
                %s,
                floor(random()*1000000)::int,
                'pending',
                %s,
                %s,
                %s,
                1,
                'USD',
                %s,
                %s,
                NOW(),
                'not_sent'
            )
            RETURNING id
            ''',
            [
                SHAMTECH_TENANT_ID,
                user_id,
                product_id,
                package_id,
                Decimal('55'),
                Decimal('45'),
            ],
        )
        created_orders.append(cursor.fetchone()[0])

    return created_orders


def seed():
    with connection.cursor() as cursor:
        prod_id, pkg_id, price_id = _fetch_existing_ids(cursor)

        if not prod_id:
            prod_id = uuid4()
            cursor.execute(
                """
                INSERT INTO product (id, "tenantId", name, description, "isActive", "supportsCounter")
                VALUES (%s, %s, %s, %s, TRUE, FALSE)
                """,
                [prod_id, SHAMTECH_TENANT_ID, 'Test PUBG 60', 'Seeded demo product for ShamTech'],
            )

        if not pkg_id:
            pkg_id = uuid4()
            cursor.execute(
                """
                INSERT INTO product_packages (
                    id, "tenantId", product_id, "publicCode", name, description, "imageUrl",
                    "basePrice", capital, type, "unitName", "unitCode", "minUnits", "maxUnits", step,
                    "providerName", "isActive"
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                """,
                [
                    pkg_id,
                    SHAMTECH_TENANT_ID,
                    prod_id,
                    6001,
                    'PUBG Global 60',
                    'Seeded package for testing',
                    None,
                    50,
                    40,
                    'fixed',
                    'code',
                    'code',
                    1,
                    1,
                    None,
                    'Manual',
                ],
            )

        if not price_id and pkg_id:
            price_id = uuid4()
            cursor.execute(
                """
                INSERT INTO package_prices (id, "tenantId", price, package_id, price_group_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [price_id, SHAMTECH_TENANT_ID, 55, pkg_id, SHAMTECH_PRICE_GROUP_ID],
            )

        orders = _ensure_demo_orders(cursor, prod_id, pkg_id)

    return prod_id, pkg_id, price_id, orders


def run():
    prod_id, pkg_id, price_id, orders = seed()
    print(f"Seeded product={prod_id} package={pkg_id} price={price_id}")
    if orders:
        print(f"Created demo orders: {', '.join(str(o) for o in orders)}")


if __name__ == '__main__':
    run()
