import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { ClassSerializerInterceptor as BaseInterceptor } from '@nestjs/common/serializer';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ClassSerializerInterceptor extends BaseInterceptor {
  constructor(reflector: Reflector) {
    super(reflector);
  }
}
