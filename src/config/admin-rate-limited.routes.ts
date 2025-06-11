import { RequestMethod } from '@nestjs/common';

export const RateLimitedAdminRoutes = [
    { path: 'branches', method: RequestMethod.POST },
    { path: 'branches', method: RequestMethod.GET },
    { path: 'admins/me', method: RequestMethod.GET },
    { path: 'admins', method: RequestMethod.POST },
    { path: 'admins/change-password', method: RequestMethod.GET },
    { path: 'features', method: RequestMethod.PATCH },
];
