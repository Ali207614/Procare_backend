import { Request } from 'express';
import { AdminPayload } from 'src/common/types/admin-payload.interface';
import { Branch } from 'src/common/types/branch.interface';

export interface AuthenticatedRequest extends Request {
  admin: AdminPayload;
  branch: Branch;
}
