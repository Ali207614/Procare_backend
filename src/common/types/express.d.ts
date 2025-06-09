import { AdminPayload } from './admin-payload.interface';
import { UserPayload } from './user-payload.interface';

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
            admin?: AdminPayload;
        }
    }
}
