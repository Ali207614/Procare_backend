// src/config/public.routes.ts
import { RequestMethod } from '@nestjs/common';

export const PublicRoutes = [
  { path: 'auth/admin/login', method: RequestMethod.POST },
  { path: 'auth/admin/register', method: RequestMethod.POST },
  { path: 'auth/admin/send-code', method: RequestMethod.POST },
  { path: 'auth/admin/verify-code', method: RequestMethod.POST },
  { path: 'auth/admin/forgot-password', method: RequestMethod.POST },
  { path: 'auth/admin/reset-password', method: RequestMethod.POST },
  // Features
  { path: 'features', method: RequestMethod.GET },
  { path: 'features/:key', method: RequestMethod.GET },
];
