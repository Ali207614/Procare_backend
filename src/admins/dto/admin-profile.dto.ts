import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

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
}

@Exclude()
class WorkDaysProfileDto {
  @ApiProperty()
  @Expose()
  monday!: boolean;

  @ApiProperty()
  @Expose()
  tuesday!: boolean;

  @ApiProperty()
  @Expose()
  wednesday!: boolean;

  @ApiProperty()
  @Expose()
  thursday!: boolean;

  @ApiProperty()
  @Expose()
  friday!: boolean;

  @ApiProperty()
  @Expose()
  saturday!: boolean;

  @ApiProperty()
  @Expose()
  sunday!: boolean;
}

@Exclude()
export class AdminProfileDto {
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
  phone_verified!: boolean;

  @ApiProperty()
  @Expose()
  passport_series!: string;

  @ApiProperty()
  @Expose()
  birth_date!: string;

  @ApiProperty()
  @Expose()
  hire_date!: string;

  @ApiProperty()
  @Expose()
  id_card_number!: string;

  @ApiProperty()
  @Expose()
  onlinepbx_code!: string;

  @ApiProperty({ type: WorkDaysProfileDto })
  @Expose()
  @Type(() => WorkDaysProfileDto)
  work_days!: WorkDaysProfileDto;

  @ApiProperty()
  @Expose()
  work_start_time!: string;

  @ApiProperty()
  @Expose()
  work_end_time!: string;

  @ApiProperty()
  @Expose()
  language!: string;

  @ApiProperty()
  @Expose()
  status!: string;

  @ApiProperty()
  @Expose()
  created_at!: Date;

  @ApiProperty()
  @Expose()
  updated_at!: Date;

  @Exclude()
  password!: string;

  @ApiProperty({ type: [BranchMiniDto] })
  @Expose()
  @Type(() => BranchMiniDto)
  branches!: BranchMiniDto[];

  @ApiProperty({ type: [RoleMiniDto] })
  @Expose()
  @Type(() => RoleMiniDto)
  roles!: RoleMiniDto[];
}
