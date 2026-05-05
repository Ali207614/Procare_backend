import { RepairOrderStatusPermissionsService } from '../../src/repair-order-status-permission/repair-order-status-permissions.service';
import { RedisService } from '../../src/common/redis/redis.service';
import { LoggerService } from '../../src/common/logger/logger.service';

type Mocked<T> = {
  [K in keyof T]: jest.Mock;
};

function createChainableQuery(result: unknown) {
  const resolved = Promise.resolve(result);
  return {
    where: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    join: jest.fn().mockReturnThis(),
    modify: jest.fn(function (callback: (qb: unknown) => void) {
      callback(this);
      return this;
    }),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(result),
    del: jest.fn().mockResolvedValue(1),
    insert: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
}

describe('RepairOrderStatusPermissionsService', () => {
  let service: RepairOrderStatusPermissionsService;
  let knex: jest.Mock & { transaction: jest.Mock };
  let redisService: Mocked<RedisService>;
  let logger: Mocked<LoggerService>;

  beforeEach(() => {
    knex = jest.fn() as unknown as jest.Mock & { transaction: jest.Mock };
    knex.transaction = jest.fn();

    redisService = {
      flushByPrefix: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    } as unknown as Mocked<RedisService>;

    logger = {
      error: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as Mocked<LoggerService>;

    service = new RepairOrderStatusPermissionsService(knex as any, redisService as any, logger as any);
  });

  it('allows bulk assignment with can_create_user and cannot_continue_without_imei across multiple statuses', async () => {
    const roleQuery = createChainableQuery([{ id: 'role-id', status: 'Open' }]);
    const statuses = [
      { id: 'status-1', branch_id: 'branch-id', status: 'Open' },
      { id: 'status-2', branch_id: 'branch-id', status: 'Open' },
    ];
    const statusQuery = createChainableQuery(statuses);
    const deleteQuery = createChainableQuery(undefined);
    const insertedRows = [
      {
        id: 'perm-1',
        branch_id: 'branch-id',
        role_id: 'role-id',
        status_id: 'status-1',
        can_create_user: true,
        cannot_continue_without_imei: true,
      },
      {
        id: 'perm-2',
        branch_id: 'branch-id',
        role_id: 'role-id',
        status_id: 'status-2',
        can_create_user: true,
        cannot_continue_without_imei: true,
      },
    ];
    const insertQuery = createChainableQuery(undefined);
    insertQuery.insert = jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(insertedRows),
    });

    const trx = jest
      .fn()
      .mockReturnValueOnce(roleQuery)
      .mockReturnValueOnce(statusQuery)
      .mockReturnValueOnce(deleteQuery)
      .mockReturnValueOnce(insertQuery) as jest.Mock & {
      commit: jest.Mock;
      rollback: jest.Mock;
    };
    trx.commit = jest.fn().mockResolvedValue(undefined);
    trx.rollback = jest.fn().mockResolvedValue(undefined);

    knex.transaction.mockResolvedValue(trx);
    jest.spyOn(service, 'flushAndReloadCacheByRole').mockResolvedValue(undefined);

    const result = await service.createManyByRole({
      branch_id: 'branch-id',
      role_id: 'role-id',
      status_ids: ['status-1', 'status-2'],
      can_create_user: true,
      cannot_continue_without_imei: true,
    });

    expect(result).toEqual({
      message: 'Permissions assigned successfully to selected role and statuses',
      count: 2,
    });
    expect(trx.commit).toHaveBeenCalled();
    expect(trx.rollback).not.toHaveBeenCalled();
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          branch_id: 'branch-id',
          role_id: 'role-id',
          status_id: 'status-1',
          can_create_user: true,
          cannot_continue_without_imei: true,
        }),
        expect.objectContaining({
          branch_id: 'branch-id',
          role_id: 'role-id',
          status_id: 'status-2',
          can_create_user: true,
          cannot_continue_without_imei: true,
        }),
      ]),
    );
  });

  it('returns permissions by role across all branches', async () => {
    const roleId = '00000000-0000-4000-8000-000000000001';
    const permissions = [
      {
        id: '00000000-0000-4000-8000-000000000010',
        branch_id: '00000000-0000-4000-8000-000000000020',
        role_id: roleId,
        status_id: '00000000-0000-4000-8000-000000000030',
      },
      {
        id: '00000000-0000-4000-8000-000000000011',
        branch_id: '00000000-0000-4000-8000-000000000021',
        role_id: roleId,
        status_id: '00000000-0000-4000-8000-000000000031',
      },
    ];
    const roleQuery = createChainableQuery({ id: roleId });
    const permissionsQuery = createChainableQuery(permissions);

    knex.mockReturnValueOnce(roleQuery).mockReturnValueOnce(permissionsQuery);

    await expect(service.findPermissionsByRole(roleId)).resolves.toEqual({
      data: permissions,
      meta: {
        total: 2,
        role_id: roleId,
      },
    });

    expect(permissionsQuery.andWhere).not.toHaveBeenCalledWith(
      'repair_order_status_permissions.branch_id',
      expect.any(String),
    );
  });

  it('returns permissions by role filtered by branch', async () => {
    const roleId = '00000000-0000-4000-8000-000000000001';
    const branchId = '00000000-0000-4000-8000-000000000020';
    const permissions = [
      {
        id: '00000000-0000-4000-8000-000000000010',
        branch_id: branchId,
        role_id: roleId,
        status_id: '00000000-0000-4000-8000-000000000030',
      },
    ];
    const roleQuery = createChainableQuery({ id: roleId });
    const permissionsQuery = createChainableQuery(permissions);

    knex.mockReturnValueOnce(roleQuery).mockReturnValueOnce(permissionsQuery);

    await expect(service.findPermissionsByRole(roleId, branchId)).resolves.toEqual({
      data: permissions,
      meta: {
        total: 1,
        role_id: roleId,
        branch_id: branchId,
      },
    });

    expect(permissionsQuery.andWhere).toHaveBeenCalledWith(
      'repair_order_status_permissions.branch_id',
      branchId,
    );
  });

  it('throws not found when role does not exist', async () => {
    const roleId = '00000000-0000-4000-8000-000000000001';
    const roleQuery = createChainableQuery(undefined);

    knex.mockReturnValueOnce(roleQuery);

    await expect(service.findPermissionsByRole(roleId)).rejects.toMatchObject({
      status: 404,
    });
  });
});
