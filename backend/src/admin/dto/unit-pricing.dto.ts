import { IsBoolean, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ERR_SUPPORTS_COUNTER_REQUIRED, ERR_UNIT_NAME_REQUIRED } from '../unit-pricing.constants';

// تم حذف دعم override لسعر الوحدة؛ لم نعد نحتاج DTO خاص به.

export class ToggleSupportsCounterDto {
  @IsBoolean({ message: ERR_SUPPORTS_COUNTER_REQUIRED })
  supportsCounter!: boolean;
}

export class UpdateUnitPackageDto {
  @IsNotEmpty({ message: ERR_UNIT_NAME_REQUIRED })
  unitName!: string;

  @IsOptional()
  unitCode?: string | null;

  @IsOptional()
  @ValidateIf(o => o.minUnits != null)
  minUnits?: string; // manual check in controller

  @IsOptional()
  @ValidateIf(o => o.maxUnits != null)
  maxUnits?: string;

  @IsOptional()
  @ValidateIf(o => o.step != null)
  step?: string;

  @IsOptional() // further validated in controller for >0 & format
  baseUnitPrice?: string;
}