import { BadRequestException } from '@nestjs/common';
import { CommentUpdaterService } from 'src/repair-orders/services/comment-updater.service';

function createKnexMock(comment: Record<string, any>) {
  const trx: any = ((table: string) => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(table === 'repair_order_comments' ? comment : undefined),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    return builder;
  }) as any;

  const knex: any = {
    transaction: jest.fn(async (callback: (trx: any) => Promise<unknown>) => callback(trx)),
  };

  return knex;
}

describe('CommentUpdaterService', () => {
  const permissionService = {
    findByRolesAndBranch: jest.fn(),
    checkPermissionsOrThrow: jest.fn(),
  } as any;
  const changeLogger = {
    logIfChanged: jest.fn(),
  } as any;
  const admin = {
    id: 'admin-1',
    roles: [],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects editing history comments', async () => {
    const knex = createKnexMock({
      repair_order_id: 'order-1',
      status_by: 'status-1',
      created_by: 'admin-1',
      status: 'Open',
      text: 'Holat o\'zgardi',
      comment_type: 'history',
    });
    const service = new CommentUpdaterService(knex, permissionService, changeLogger);

    await expect(service.update('comment-1', 'Yangilandi', admin)).rejects.toThrow(
      new BadRequestException({
        message: 'History comments cannot be edited',
        location: 'comment_id',
      }),
    );
  });

  it('rejects deleting history comments', async () => {
    const knex = createKnexMock({
      repair_order_id: 'order-1',
      status_by: 'status-1',
      text: 'Holat o\'zgardi',
      comment_type: 'history',
    });
    const service = new CommentUpdaterService(knex, permissionService, changeLogger);

    await expect(service.delete('comment-1', admin)).rejects.toThrow(
      new BadRequestException({
        message: 'History comments cannot be deleted',
        location: 'comment_id',
      }),
    );
  });
});
