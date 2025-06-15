import { RequestMethod } from '@nestjs/common';

export const RateLimitedAdminRoutes = [
    { path: 'branches/', method: RequestMethod.POST },
    { path: 'branches/', method: RequestMethod.GET },
    { path: 'branches/:id', method: RequestMethod.GET },
    { path: 'branches/:id', method: RequestMethod.PATCH },
    { path: 'branches/:id', method: RequestMethod.DELETE },
    { path: 'branches/:id/sort', method: RequestMethod.PATCH },
    { path: 'branches/viewable', method: RequestMethod.GET },

    { path: 'admins/me', method: RequestMethod.GET },
    { path: 'admins', method: RequestMethod.POST },
    { path: 'admins/:id', method: RequestMethod.PATCH },
    { path: 'admins/:id', method: RequestMethod.DELETE },
    { path: 'admins/change-password', method: RequestMethod.GET },

    { path: 'features', method: RequestMethod.PATCH },
    { path: 'features', method: RequestMethod.GET },
    { path: 'features/:key', method: RequestMethod.GET },
];
