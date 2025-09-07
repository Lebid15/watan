import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class MuhUpdatePartyDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsNumber() debt_try?: number;
  @IsOptional() @IsNumber() debt_usd?: number;
  @IsOptional() @IsString() note?: string | null;
}
