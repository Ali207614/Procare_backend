import { Request } from 'express';
import { Branch } from 'src/common/types/branch.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { RepairOrderStatus } from 'src/common/types/repair-order-status.interface';

export interface AuthenticatedRequest extends Request {
  admin: AdminPayload;
  branch: Branch;
  status: RepairOrderStatus;
}
