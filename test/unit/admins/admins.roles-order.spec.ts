import { Knex } from 'knex';
import { AdminsService } from 'src/admins/admins.service';
import { RedisService } from 'src/common/redis/redis.service';
import { PermissionsService } from 'src/permissions/permissions.service';

describe('AdminsService role ordering', () => {
  it('loads admin roles in a deterministic order', async () => {
    const queryBuilder = {
      join: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue([
        { id: 'role-b', name: 'B' },
        { id: 'role-a', name: 'A' },
      ]),
    };

    const knex = jest.fn().mockReturnValue(queryBuilder);
    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn(),
      flushByPrefix: jest.fn(),
    };
    const permissionsService = {} as unknown as PermissionsService;

    const service = new AdminsService(
      knex as unknown as Knex,
      redisService as unknown as RedisService,
      permissionsService,
    );

    await service.findRolesByAdminId('admin-id');

    expect(queryBuilder.orderBy).toHaveBeenCalledWith('admin_roles.role_id', 'asc');
  });
});
