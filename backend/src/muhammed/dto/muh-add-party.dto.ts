import { IsNotEmpty, IsOptional, IsString, Max, Min, MaxLength, IsInt } from 'class-validator';

export class MuhAddPartyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  display_order?: number;
}
