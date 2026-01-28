import { IsUUID } from 'class-validator';

export class TransferBranchDto {
  @IsUUID()
  new_branch_id: string;
}
