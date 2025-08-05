import { RequestMethod } from '@nestjs/common';

export const RateLimitedAdminRoutes = [
  { path: 'repair-order-statuses/', method: RequestMethod.POST },
  { path: 'repair-order-statuses/viewable', method: RequestMethod.GET },
  { path: 'repair-order-statuses/all', method: RequestMethod.GET },
  { path: 'repair-order-statuses/:id/sort', method: RequestMethod.GET },
  { path: 'repair-order-statuses/:id', method: RequestMethod.DELETE },
  { path: 'repair-order-statuses/:id', method: RequestMethod.PATCH },

  { path: 'branches/', method: RequestMethod.POST },
  { path: 'branches', method: RequestMethod.GET },
  { path: 'branches/:id', method: RequestMethod.GET },
  { path: 'branches/:id', method: RequestMethod.PATCH },
  { path: 'branches/:id', method: RequestMethod.DELETE },
  { path: 'branches/:id/sort', method: RequestMethod.PATCH },
  { path: 'branches/viewable', method: RequestMethod.GET },

  { path: 'roles/', method: RequestMethod.POST },
  { path: 'roles', method: RequestMethod.GET },
  { path: 'roles/:id', method: RequestMethod.GET },
  { path: 'roles/:id', method: RequestMethod.PATCH },
  { path: 'roles/:id', method: RequestMethod.DELETE },
  { path: 'branches/:id/sort', method: RequestMethod.PATCH },
  { path: 'branches/viewable', method: RequestMethod.GET },

  { path: 'admins/me', method: RequestMethod.GET },
  { path: 'admins', method: RequestMethod.GET },
  { path: 'admins', method: RequestMethod.POST },
  { path: 'admins/:id', method: RequestMethod.PATCH },
  { path: 'admins/:id', method: RequestMethod.DELETE },
  { path: 'admins/change-password', method: RequestMethod.GET },

  { path: 'features', method: RequestMethod.PATCH },
  { path: 'features', method: RequestMethod.GET },
  { path: 'features/:key', method: RequestMethod.GET },

  { path: 'users/', method: RequestMethod.GET },
  { path: 'users/:id', method: RequestMethod.GET },
  { path: 'users/', method: RequestMethod.POST },
  { path: 'users/:id', method: RequestMethod.PATCH },
  { path: 'users/:id', method: RequestMethod.DELETE },
];
