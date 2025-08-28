import { IsInt, Min } from 'class-validator';

export class UpdatePackageCodeDto {
  @IsInt()
  @Min(1)
  publicCode!: number;
}
