import { Exclude, Expose, Type } from 'class-transformer';

@Exclude()
class BranchMiniDto {
  @Expose()
  id: string;

  @Expose()
  name_uz: string;

  @Expose()
  name_ru: string;

  @Expose()
  name_en: string;
}

@Exclude()
class RoleMiniDto {
  @Expose()
  id: string;

  @Expose()
  name: string;
}

@Exclude()
export class AdminProfileDto {
  @Expose()
  id: string;

  @Expose()
  first_name: string;

  @Expose()
  last_name: string;

  @Expose()
  phone_number: string;

  @Expose()
  is_active: boolean;

  @Expose()
  phone_verified: boolean;

  @Expose()
  passport_series: string;

  @Expose()
  birth_date: string;

  @Expose()
  hire_date: string;

  @Expose()
  id_card_number: string;

  @Expose()
  language: string;

  @Expose()
  status: string;

  @Expose()
  created_at: Date;

  @Expose()
  updated_at: Date;

  @Exclude()
  password: string;

  @Expose()
  @Type(() => BranchMiniDto)
  branches: BranchMiniDto[];

  @Expose()
  @Type(() => RoleMiniDto)
  roles: RoleMiniDto[];
}
