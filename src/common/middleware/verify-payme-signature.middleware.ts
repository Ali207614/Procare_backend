// import { Injectable, NestMiddleware } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// import * as crypto from 'crypto';

// @Injectable()
// export class VerifyPaymeSignatureMiddleware implements NestMiddleware {
//     use(req: Request, res: Response, next: NextFunction) {
//         const receivedSignature = req.headers['x-payme-signature'];
//         const rawBody = JSON.stringify(req.body);
//         const secretKey = process.env.PAYME_SECRET_KEY;

//         const expectedSignature = crypto
//             .createHmac('sha1', secretKey)
//             .update(rawBody)
//             .digest('base64');

//         if (receivedSignature !== expectedSignature) {
//             return res.status(401).json({
//                 error: {
//                     code: -32504,
//                     message: {
//                         uz: 'Imzo noto‘g‘ri.',
//                         ru: 'Подпись недействительна.',
//                         en: 'Invalid signature.',
//                     },
//                     data: 'signature',
//                 },
//             });
//         }

//         next();
//     }
// }
