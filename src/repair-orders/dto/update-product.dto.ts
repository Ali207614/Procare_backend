import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  phone_category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  imei?: string;
}