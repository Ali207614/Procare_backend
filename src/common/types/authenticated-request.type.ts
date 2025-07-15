import { Request } from 'express';
import { Branch } from 'src/common/types/branch.interface';
import { AdminPayload } from 'src/common/types/admin-payload.interface';

export interface AuthenticatedRequest extends Request {
  admin: AdminPayload;
  branch: Branch;
}
