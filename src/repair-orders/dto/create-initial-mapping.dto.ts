import { IsUUID, IsString, MaxLength } from 'class-validator';

export class CreateInitialMappingDto {
  @IsUUID()
  problem_category_id: string;

  @IsString()
  @MaxLength(1000)
  description: string;
}