import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { RoleType } from 'src/common/types/role-type.enum';

@Exclude()
class BranchMiniDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name_uz!: string;

  @ApiProperty()
  @Expose()
  name_ru!: string;

  @ApiProperty()
  @Expose()
  name_en!: string;
}

@Exclude()
class RoleMiniDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: RoleType, nullable: true, required: false })
  @Expose()
  type?: RoleType | null;
}

@Exclude()
export class AdminListItemDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  first_name!: string;

  @ApiProperty()
  @Expose()
  last_name!: string;

  @ApiProperty()
  @Expose()
  phone_number!: string;

  @ApiProperty()
  @Expose()
  is_active!: boolean;

  @ApiProperty()
  @Expose()
  language!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty({ type: [BranchMiniDto] })
  @Expose()
  @Type(() => BranchMiniDto)
  branches!: BranchMiniDto[];

  @ApiProperty({ type: [RoleMiniDto] })
  @Expose()
  @Type(() => RoleMiniDto)
  roles!: RoleMiniDto[];
}
