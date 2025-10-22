import { IsArray, ArrayNotEmpty, ArrayUnique, IsUUID } from 'class-validator';

export class RemoveAdminDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  admin_ids!: string[];
}
