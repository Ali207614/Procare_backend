import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ParseUUIDPipe } from '../pipe/parse-uuid.pipe';
import { RepairOrderStatusesService } from 'src/repair-order-statuses/repair-order-statuses.service';

@Injectable()
export class RepairOrderStatusExistGuard implements CanActivate {
  constructor(private readonly repairOrderStatusService: RepairOrderStatusesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const statusId =
      request.body?.status_id ||
      request.query?.status_id ||
      request.params?.status_id ||
      request.params?.id;

    try {
      const parser = new ParseUUIDPipe();
      parser.transform(statusId);
    } catch (err) {
      throw new BadRequestException({
        message: 'Invalid status ID format. Must be a valid UUID.',
        location: 'status_id_format',
      });
    }

    request.status = await this.repairOrderStatusService.getOrLoadStatusById(statusId);
    return true;
  }
}
