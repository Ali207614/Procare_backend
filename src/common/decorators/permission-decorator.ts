import { SetMetadata, applyDecorators } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';
export const PERMISSIONS_MODE_KEY = 'permissions_mode';

export type PermissionMode = 'OR' | 'AND';

export const SetPermissions = (...permissions: string[]): ReturnType<typeof SetMetadata> => {
  return SetMetadata(PERMISSIONS_KEY, permissions);
};

export const SetAllPermissions = (...permissions: string[]): ReturnType<typeof applyDecorators> => {
  return applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSIONS_MODE_KEY, 'AND'),
  );
};
