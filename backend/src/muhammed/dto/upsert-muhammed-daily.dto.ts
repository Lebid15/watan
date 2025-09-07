import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertMuhammedDailyDto {
  @IsDateString()
  entryDate!: string; // date only

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  value?: number;
}
