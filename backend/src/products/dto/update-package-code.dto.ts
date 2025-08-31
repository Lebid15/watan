import { IsInt, Min, IsOptional } from 'class-validator';

export class UpdatePackageCodeDto {
	// السماح بإرسال null لمسح الكود، أو رقم صحيح موجب لضبطه
	@IsOptional()
	@IsInt()
	@Min(1)
	publicCode?: number | null;
}


