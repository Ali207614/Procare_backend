import { IsArray, ArrayUnique, IsUUID } from 'class-validator';

export class AssignAdminsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  admin_ids!: string[];
}
