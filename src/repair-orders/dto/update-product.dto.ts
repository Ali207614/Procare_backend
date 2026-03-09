import { IsUUID, IsString, MaxLength, ValidateIf, IsNotEmpty, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Phone category ID',
    example: 'd3e4b1cd-8f20-4b94-b05c-63156cbe02ec',
  })
  @ValidateIf((o) => o.phone_category_id !== undefined || o.imei !== undefined)
  @IsUUID()
  @IsNotEmpty({ message: 'Phone category is required when IMEI is provided' })
  phone_category_id?: string;

  @ApiPropertyOptional({
    description: 'IMEI number',
    example: '123456789012345',
  })
  @ValidateIf((o) => o.phone_category_id !== undefined || o.imei !== undefined)
  @IsString()
  @MinLength(14)
  @MaxLength(14)
  @IsNotEmpty({ message: 'IMEI is required when phone category is provided' })
  imei?: string;
}
