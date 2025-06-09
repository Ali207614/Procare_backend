import { RequestMethod } from '@nestjs/common';

export const RateLimitedAdminRoutes = [
    { path: 'subscription/cancel', method: RequestMethod.POST },
    { path: 'subscription/grant', method: RequestMethod.POST },
    { path: 'features', method: RequestMethod.PATCH },
];
