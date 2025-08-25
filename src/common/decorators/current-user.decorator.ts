// import { createParamDecorator, ExecutionContext } from '@nestjs/common';
// import { Request } from 'express';
// import { UserPayload } from '../types/user-payload.interface';
//
// interface UserRequest extends Request {
//   user: UserPayload;
// }
//
// export const CurrentUser = createParamDecorator(
//   (_data: unknown, ctx: ExecutionContext): UserPayload => {
//     const request = ctx.switchToHttp().getRequest<UserRequest>();
//     return request.user;
//   },
// );
