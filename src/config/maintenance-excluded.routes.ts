// src/config/maintenance-excluded.routes.ts
import { RequestMethod } from '@nestjs/common';

export const MaintenanceExcludedRoutes = [
  { path: 'health', method: RequestMethod.GET },
  { path: 'features', method: RequestMethod.GET },
  { path: 'auth/login', method: RequestMethod.POST },
  { path: 'auth/register', method: RequestMethod.POST },
  { path: 'booking/date/:date', method: RequestMethod.GET },
];
