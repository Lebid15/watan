import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingProductOrderColumns20250903T1430 implements MigrationInterface {
  name = 'AddMissingProductOrderColumns20250903T1430';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const missingColumns = [
      'quantity INTEGER DEFAULT 1',
      'sellPriceCurrency VARCHAR(10) DEFAULT \'USD\'',
      'sellPriceAmount DECIMAL(10,2) DEFAULT 0',
      'price DECIMAL(10,2) DEFAULT 0',
      'costCurrency VARCHAR(10) DEFAULT \'USD\'',
      'costAmount DECIMAL(10,2) DEFAULT 0',
      'profitAmount DECIMAL(10,2) DEFAULT 0',
      'userIdentifier VARCHAR NULL',
      'extraField VARCHAR NULL',
      'providerId VARCHAR NULL',
      'attempts INTEGER DEFAULT 0',
      'lastMessage VARCHAR(250) NULL',
      'manualNote TEXT NULL',
      'notes JSONB DEFAULT \'[]\'',
      'pinCode VARCHAR(120) NULL',
      'sentAt TIMESTAMPTZ NULL',
      'lastSyncAt TIMESTAMPTZ NULL',
      'completedAt TIMESTAMPTZ NULL',
      'durationMs INTEGER NULL',
      'fxUsdTryAtApproval NUMERIC(12,6) NULL',
      'sellTryAtApproval NUMERIC(12,2) NULL',
      'costTryAtApproval NUMERIC(12,2) NULL',
      'profitTryAtApproval NUMERIC(12,2) NULL',
      'profitUsdAtApproval NUMERIC(12,2) NULL',
      'approvedAt TIMESTAMPTZ NULL',
      'approvedLocalDate DATE NULL',
      'approvedLocalMonth CHAR(7) NULL',
      'fxCapturedAt TIMESTAMPTZ NULL',
      'fxSource VARCHAR(50) NULL',
      'fxLocked BOOLEAN DEFAULT false',
      'providerMessage TEXT NULL',
      'notesCount INTEGER DEFAULT 0',
      'placedByDistributorId UUID NULL',
      'distributorCapitalUsdAtOrder DECIMAL(18,6) NULL',
      'distributorSellUsdAtOrder DECIMAL(18,6) NULL',
      'distributorProfitUsdAtOrder DECIMAL(18,6) NULL',
      'fxUsdToDistAtOrder DECIMAL(18,6) NULL',
      'distCurrencyCodeAtOrder VARCHAR(10) NULL',
      'orderNo INTEGER NULL'
    ];

    for (const column of missingColumns) {
      const columnName = column.split(' ')[0];
      const hasColumn = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='product_orders' AND column_name='${columnName}'
      `);
      
      if (hasColumn.length === 0) {
        await queryRunner.query(`ALTER TABLE "product_orders" ADD COLUMN ${column}`);
      }
    }

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
