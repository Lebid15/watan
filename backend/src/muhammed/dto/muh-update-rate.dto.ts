import { IsNumber } from 'class-validator';

export class MuhUpdateRateDto {
  @IsNumber()
  rate!: number;
}
