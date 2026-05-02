import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RoleType } from 'src/common/types/role-type.enum';

export class CreateRoleDto {
  @ApiProperty({ example: 'Admin', description: 'Role name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { context: { location: 'role_name_min' } })
  @MaxLength(30, { context: { location: 'role_name_max' } })
  name!: string;

  @ApiProperty({
    example: ['00000000-0000-4000-8000-000000000005'],
    description: 'Permissions IDS',
  })
  @IsArray()
  @IsOptional()
  permission_ids?: string[];

  @ApiProperty({
    example: RoleType.SPECIALIST,
    enum: RoleType,
    required: false,
    nullable: true,
    description: 'Stable canonical type for system roles',
  })
  @IsOptional()
  @IsEnum(RoleType, { context: { location: 'role_type' } })
  type?: RoleType | null;

  @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'], description: 'Role status' })
  @IsOptional()
  @IsEnum(['Open', 'Deleted'])
  status?: 'Open' | 'Deleted';

  @ApiProperty({ example: true, description: 'Whether the role is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
