import { AdminPayload } from '../common/types/admin-payload.interface';
import { UserPayload } from '../common/types/user-payload.interface';

declare global {
  namespace Express {
    interface User extends UserPayload {}
    interface Request {
      user?: User;
      admin?: AdminPayload;
    }
  }
}
