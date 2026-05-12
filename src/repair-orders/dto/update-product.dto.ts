import { IsUUID, IsString, IsOptional, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Phone category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @IsOptional()
  @IsUUID()
  phone_category_id?: string;

  @ApiPropertyOptional({
    description: 'IMEI number',
    example: '123456789012345',
  })
  @IsOptional()
  @IsString()
  @Matches(/^$|^\d{15}$/, { message: 'IMEI must be exactly 15 digits or empty' })
  imei?: string;
}
