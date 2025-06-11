import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
    @ApiProperty({ example: 'Admin', description: 'Role nomi' })
    @IsString()
    @IsNotEmpty()
    @MinLength(1, { context: { location: 'role_name_min' } })
    @MaxLength(30, { context: { location: 'role_name_max' } })
    name: string;

    @ApiProperty({
        example: ['00000000-0000-0000-0000-000000000005'],
        description: 'Permissionlar IDlar ro‘yxati',
    })
    @IsArray()
    @IsUUID('all', { each: true })
    @IsOptional()
    permission_ids?: string[];

    @ApiProperty({ example: 'Open', enum: ['Open', 'Deleted'], description: 'Branch status' })
    @IsOptional()
    @IsEnum(['Open', 'Deleted'])
    status?: 'Open' | 'Deleted';


    @ApiProperty({ example: true, description: 'Whether the branch is active' })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;
}
