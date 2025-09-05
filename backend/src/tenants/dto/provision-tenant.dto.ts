import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class ProvisionTenantDto {
  @IsString() @MaxLength(120)
  name!: string;

  @IsString() @Matches(/^[a-z0-9-]{3,40}$/)
  code!: string; // required to construct subdomain

  @IsString() @MaxLength(190)
  host!: string; // full host e.g. sham.syrz1.com

  @IsOptional() @IsUUID()
  ownerUserId?: string;

  @IsOptional() @IsString() @MaxLength(200)
  note?: string;
}
