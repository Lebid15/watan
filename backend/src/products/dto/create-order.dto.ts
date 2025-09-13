import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ description: 'معرّف المنتج', example: 'uuid-product' })
  productId: string;

  @ApiProperty({ description: 'معرّف الباقة', example: 'uuid-package' })
  packageId: string;

  @ApiPropertyOptional({
    description: 'الكمية مطلوبة فقط عندما تكون الباقة من النوع unit. تحترم minUnits/maxUnits/step (دقة 4). مثال: 2.5',
    example: '2.5',
  })
  quantity?: string;

  @ApiPropertyOptional({ description: 'معرّف المستخدم داخل اللعبة/النظام الخارجي', example: 'player123' })
  userIdentifier?: string;

  @ApiPropertyOptional({ description: 'حقل إضافي' })
  extraField?: string;

  @ApiPropertyOptional({ description: 'مفتاح Idempotency (اختياري)' })
  orderUuid?: string | null;
}
