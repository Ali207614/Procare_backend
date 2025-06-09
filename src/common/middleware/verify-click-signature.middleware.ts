// import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
// import { Request, Response, NextFunction } from 'express';
// import { generateClickSignature } from 'src/payments/click/click.utils';

// @Injectable()
// export class VerifyClickSignatureMiddleware implements NestMiddleware {
//     use(req: Request, res: Response, next: NextFunction) {
//         const body = req.body;
//         const secretKey = process.env.CLICK_SECRET_KEY;

//         const expectedSignature = generateClickSignature({
//             ...body,
//             secret_key: secretKey,
//         });

//         if (expectedSignature !== body.sign_string) {
//             return res.status(401).json({
//                 error: {
//                     code: -1,
//                     message: {
//                         uz: 'Imzo noto‘g‘ri.',
//                         ru: 'Подпись недействительна.',
//                         en: 'Invalid signature.',
//                     },
//                     data: 'sign_string',
//                 },
//             });
//         }

//         next();
//     }
// }
