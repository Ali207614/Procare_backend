// src/common/middleware/verify-raw-body.middleware.ts
import { json, Request, Response } from 'express';

interface RequestWithRawBody extends Request {
  rawBody?: string;
}

export const VerifyRawBodyMiddleware = json({
  verify: (req: RequestWithRawBody, _res: Response, buf: Buffer) => {
    req.rawBody = buf.toString('utf8');
  },
});
