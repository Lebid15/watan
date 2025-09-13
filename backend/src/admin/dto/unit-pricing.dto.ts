import { IsBoolean, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import { ERR_SUPPORTS_COUNTER_REQUIRED, ERR_UNIT_PRICE_REQUIRED, ERR_UNIT_PRICE_INVALID, ERR_UNIT_NAME_REQUIRED } from '../unit-pricing.constants';
import { isValidDec } from '../../products/decimal.util';

// Helper decorator for decimal strings (scale <=4 enforced by code via toFixed)
export class SetUnitPriceOverrideDto {
  @IsNotEmpty({ message: ERR_UNIT_PRICE_REQUIRED })
  unitPrice!: string; // validation refined manually

  validate() {
    if (!isValidDec(this.unitPrice)) throw new Error(ERR_UNIT_PRICE_INVALID);
    if (!(parseFloat(this.unitPrice) > 0)) throw new Error(ERR_UNIT_PRICE_INVALID);
  }
}

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