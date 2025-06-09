// src/config/public.routes.ts
import { RequestMethod } from '@nestjs/common';

export const PublicRoutes = [
    { path: 'auth/login', method: RequestMethod.POST },
    { path: 'auth/register', method: RequestMethod.POST },
    { path: 'auth/send-code', method: RequestMethod.POST },
    { path: 'auth/verify-code', method: RequestMethod.POST },
    { path: 'auth/forgot-password', method: RequestMethod.POST },
    { path: 'auth/reset-password', method: RequestMethod.POST },
    // Features
    { path: 'features', method: RequestMethod.GET },
    { path: 'features/:key', method: RequestMethod.GET },
];
