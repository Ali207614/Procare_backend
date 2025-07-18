import { IsArray, ArrayNotEmpty, ArrayUnique, IsUUID } from 'class-validator';

export class AssignAdminsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  admin_ids!: string[];
}
