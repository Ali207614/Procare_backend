import 'reflect-metadata';
import { validate } from 'class-validator';
import { CreateRepairOrderDto } from '../../src/repair-orders/dto/create-repair-order.dto';
import { FindAllRepairOrdersQueryDto } from '../../src/repair-orders/dto/find-all-repair-orders.dto';
import { UpdateRepairOrderDto } from '../../src/repair-orders/dto/update-repair-order.dto';

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

  it('allows agreed_date to be provided as a string field', async () => {
    const dto = new CreateRepairOrderDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.agreed_date = '2026-04-01 09:30';

    const errors = await validate(dto);
    const agreedDateError = errors.find((error) => error.property === 'agreed_date');

    expect(agreedDateError).toBeUndefined();
  });

  it("accepts Sug'urta as a repair order source when creating", async () => {
    const dto = new CreateRepairOrderDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.source = "Sug'urta";

    const errors = await validate(dto);
    const sourceError = errors.find((error) => error.property === 'source');

    expect(sourceError).toBeUndefined();
  });

  it("accepts Sug'urta as a repair order source when updating", async () => {
    const dto = new UpdateRepairOrderDto();
    dto.source = "Sug'urta";

    const errors = await validate(dto);
    const sourceError = errors.find((error) => error.property === 'source');

    expect(sourceError).toBeUndefined();
  });

  it("accepts Sug'urta in repair order source filters", async () => {
    const dto = new FindAllRepairOrdersQueryDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.source_types = ["Sug'urta"];

    const errors = await validate(dto);
    const sourceTypesError = errors.find((error) => error.property === 'source_types');

    expect(sourceTypesError).toBeUndefined();
  });

  it('accepts Web as a repair order source', async () => {
    const createDto = new CreateRepairOrderDto();
    createDto.branch_id = '00000000-0000-4000-8000-000000000000';
    createDto.source = 'Web';

    const updateDto = new UpdateRepairOrderDto();
    updateDto.source = 'Web';

    const filterDto = new FindAllRepairOrdersQueryDto();
    filterDto.branch_id = '00000000-0000-4000-8000-000000000000';
    filterDto.source_types = ['Web'];

    const [createErrors, updateErrors, filterErrors] = await Promise.all([
      validate(createDto),
      validate(updateDto),
      validate(filterDto),
    ]);

    expect(createErrors.find((error) => error.property === 'source')).toBeUndefined();
    expect(updateErrors.find((error) => error.property === 'source')).toBeUndefined();
    expect(filterErrors.find((error) => error.property === 'source_types')).toBeUndefined();
  });

  it('accepts smart search in repair order filters', async () => {
    const dto = new FindAllRepairOrdersQueryDto();
    dto.branch_id = '00000000-0000-4000-8000-000000000000';
    dto.search = 'iPhone 14';

    const errors = await validate(dto);
    const searchError = errors.find((error) => error.property === 'search');

    expect(searchError).toBeUndefined();
  });
});
