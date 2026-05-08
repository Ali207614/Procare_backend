import { IsOptional, IsNumberString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { EnumBooleanString } from 'src/roles/dto/find-all-roles.dto';

export class FindNotificationsDto {
  @ApiPropertyOptional({
    description: 'Filter by read status (true/false)',
    enum: EnumBooleanString,
    example: EnumBooleanString.TRUE,
  })
  @IsOptional()
  @IsEnum(EnumBooleanString, { message: 'Filter must be true or false' })
  @Transform(({ value }: TransformFnParams) => {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true') return EnumBooleanString.TRUE;
      if (lower === 'false') return EnumBooleanString.FALSE;

      return value;
    }
    return value as EnumBooleanString;
  })
  is_read?: EnumBooleanString;

  @ApiPropertyOptional({ description: 'Sahifa raqami', example: '1' })
  @IsOptional()
  @IsNumberString()
  offset?: string;

  @ApiPropertyOptional({ description: 'Sahifadagi elementlar soni', example: '20' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
