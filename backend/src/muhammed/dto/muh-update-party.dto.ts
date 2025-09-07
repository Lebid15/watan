import { IsNumber, IsOptional, IsString, MaxLength, IsInt, Min, Max } from 'class-validator';

export class MuhUpdatePartyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsNumber() debt_try?: number;
  @IsOptional() @IsNumber() debt_usd?: number;
  @IsOptional() @IsString() note?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(100000) display_order?: number | null;
}
