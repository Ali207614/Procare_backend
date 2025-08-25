import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PERMISSIONS_MODE_KEY,
  PermissionMode,
} from '../decorators/permission-decorator';
import { PermissionsService } from '../../permissions/permissions.service';
import { UserPayload } from 'src/common/types/user-payload.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const mode: PermissionMode =
      this.reflector.getAllAndOverride(PERMISSIONS_MODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'OR';

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserPayload = request.user;

    if (!user) {
      throw new ForbiddenException({
        message: 'The specified user does not exist or is no longer active.',
        location: 'not_found',
      });
    }

    const userPermissions = await this.permissionsService.getPermissions(user.id);

    const hasPermission =
      mode === 'AND'
        ? requiredPermissions.every((p) => userPermissions.includes(p))
        : requiredPermissions.some((p) => userPermissions.includes(p));

    if (!hasPermission) {
      throw new ForbiddenException({
        message: 'You do not have the required permissions to perform this action.',
        location: 'permission_denied',
      });
    }

    return true;
  }
}
