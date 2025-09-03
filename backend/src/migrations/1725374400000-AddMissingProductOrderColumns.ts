import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingProductOrderColumns1725374400000 implements MigrationInterface {
  name = 'AddMissingProductOrderColumns1725374400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('AddMissingProductOrderColumns: Skipping - columns already exist or handled elsewhere');
    return;

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_tenant" ON "product_orders" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_order_no" ON "product_orders" ("orderNo")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "product_orders" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_orders_placed_by_distributor" ON "product_orders" ("placedByDistributorId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columnsToRemove = [
      'quantity', 'sellPriceCurrency', 'sellPriceAmount', 'price', 'costCurrency', 'costAmount',
      'profitAmount', 'userIdentifier', 'extraField', 'providerId', 'attempts', 'lastMessage',
      'manualNote', 'notes', 'pinCode', 'sentAt', 'lastSyncAt', 'completedAt', 'durationMs',
      'fxUsdTryAtApproval', 'sellTryAtApproval', 'costTryAtApproval', 'profitTryAtApproval',
      'profitUsdAtApproval', 'approvedAt', 'approvedLocalDate', 'approvedLocalMonth',
      'fxCapturedAt', 'fxSource', 'fxLocked', 'providerMessage', 'notesCount',
      'placedByDistributorId', 'distributorCapitalUsdAtOrder', 'distributorSellUsdAtOrder',
      'distributorProfitUsdAtOrder', 'fxUsdToDistAtOrder', 'distCurrencyCodeAtOrder', 'orderNo'
    ];

    for (const column of columnsToRemove) {
      await queryRunner.query(`ALTER TABLE "product_orders" DROP COLUMN IF EXISTS "${column}"`);
    }
  }
}
