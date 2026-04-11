import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateRepairOrderDto } from '../../src/repair-orders/dto/create-repair-order.dto';

describe('CreateRepairOrderDto', () => {
  it('accepts UUID-like custom status ids used by seeded repair statuses', async () => {
    const dto = new CreateRepairOrderDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.status_id = '50000000-0000-0000-0001-001000000000';

    const errors = await validate(dto);
    const statusError = errors.find((error) => error.property === 'status_id');

    expect(statusError).toBeUndefined();
  });

  it('still rejects clearly invalid status ids', async () => {
    const dto = new CreateRepairOrderDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.status_id = 'not-a-status-id';

    const errors = await validate(dto);
    const statusError = errors.find((error) => error.property === 'status_id');

    expect(statusError).toBeDefined();
    expect(statusError?.constraints).toHaveProperty('matches', 'Invalid status ID');
  });
});
