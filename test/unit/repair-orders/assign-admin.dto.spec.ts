import { validate } from 'class-validator';
import { AssignAdminsDto } from 'src/repair-orders/dto/assign-admin.dto';

describe('AssignAdminsDto', () => {
  it('allows an empty admin_ids array so assignments can be cleared', async () => {
    const dto = new AssignAdminsDto();
    dto.admin_ids = [];

    const errors = await validate(dto);

    expect(errors.find((error) => error.property === 'admin_ids')).toBeUndefined();
  });

  it('still rejects invalid admin ids', async () => {
    const dto = new AssignAdminsDto();
    dto.admin_ids = ['not-a-uuid'];

    const errors = await validate(dto);
    const adminIdsError = errors.find((error) => error.property === 'admin_ids');

    expect(adminIdsError).toBeDefined();
    expect(adminIdsError?.constraints).toHaveProperty('isUuid');
  });
});
