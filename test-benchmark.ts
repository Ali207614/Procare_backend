import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { RepairOrderStatusPermissionsService } from './src/repair-order-status-permission/repair-order-status-permissions.service';
import { RedisService } from './src/common/redis/redis.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(RepairOrderStatusPermissionsService);
  const redisService = app.get(RedisService);

  console.log('App initialized.');

  // Create mock permissions
  const permissions = Array.from({ length: 1000 }).map((_, i) => ({
    id: `id-${i}`,
    role_id: `role-${i}`,
    status_id: `status-${i}`,
    branch_id: `branch-${i}`,
    can_change_status: true,
    can_update: true,
    can_user_manage: true,
    can_add: true,
    can_view: true,
    can_delete: true,
    can_assign_admin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const start = Date.now();
  // @ts-ignore - testing private method
  await service.invalidateCachesForPermissions(permissions);
  const end = Date.now();

  console.log(`Time taken: ${end - start}ms`);

  await app.close();
}

bootstrap();
