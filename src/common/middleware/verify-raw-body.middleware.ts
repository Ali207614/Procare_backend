// src/common/middleware/verify-raw-body.middleware.ts
import { json } from 'express';

export const VerifyRawBodyMiddleware = json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf.toString('utf8');
    },
});
