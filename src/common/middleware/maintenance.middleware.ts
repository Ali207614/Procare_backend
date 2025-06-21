import { Injectable, NestMiddleware, RequestMethod } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FeatureService } from 'src/feature/feature.service';
import { MaintenanceExcludedRoutes } from 'src/config/maintenance-excluded.routes';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
    constructor(private readonly featureService: FeatureService) { }

    async use(req: Request, res: Response, next: NextFunction) {
        try {
            const start = Date.now();
            const isOperational = await this.featureService.isFeatureActive('system.operational');
            const duration = Date.now() - start;
            console.log(`🛠 isMaintenance: ${isOperational} (${duration}ms)`);

            if (isOperational) return next();


            const rawPath = req.originalUrl || req.url || req.path;
            const reqPath = rawPath.split('?')[0].replace(/\/+$/, '');
            const reqMethod = req.method.toUpperCase();


            const isExcluded = MaintenanceExcludedRoutes.some((route) => {
                const routeBase = route.path.split('/:')[0]; // `/booking/date`
                const methodMatches = reqMethod === RequestMethod[route.method];
                const pathMatches = reqPath.startsWith(`/${routeBase}`);
                return methodMatches && pathMatches;
            });

            console.log(`🔍 isExcluded: ${isExcluded}`);

            if (isExcluded) return next();

            return res.status(503).json({
                message: '🛠 Texnik ishlar ketmoqda. Iltimos, keyinroq urinib ko‘ring.',
                location: 'maintenance_mode',
            });
        } catch (e) {
            console.error('❌ MaintenanceMiddleware error:', e);
            return next();
        }
    }
}
