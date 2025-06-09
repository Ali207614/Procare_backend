import { RequestMethod } from '@nestjs/common';

export const RateLimitedAdminRoutes = [

    { path: 'admins/me', method: RequestMethod.GET },
    { path: 'admins/change-password', method: RequestMethod.GET },
    { path: 'features', method: RequestMethod.PATCH },
];
