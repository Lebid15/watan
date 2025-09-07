import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class MuhAddPartyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}
