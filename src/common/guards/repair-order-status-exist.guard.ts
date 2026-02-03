import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { validate as isUUID } from 'uuid';
import { RepairOrderStatusesService } from 'src/repair-order-statuses/repair-order-statuses.service';

@Injectable()
export class RepairOrderStatusExistGuard implements CanActivate {
  constructor(private readonly repairOrderStatusService: RepairOrderStatusesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const statusId: string =
      request.body?.status_id || request.query?.status_id || request.params?.status_id;

    if (!statusId) {
      throw new BadRequestException({
        message: 'Status ID is required',
        location: 'status_id_required',
      });
    }

    // Validate UUID or custom status ID format
    if (!this.isValidStatusId(statusId)) {
      throw new BadRequestException({
        message: 'Invalid status ID format. Must be a valid UUID.',
        location: 'status_id_format',
      });
    }

    try {
      request.status = await this.repairOrderStatusService.getOrLoadStatusById(statusId);
      return true;
    } catch (error) {
      throw new BadRequestException({
        message: 'Status not found or invalid',
        location: 'status_id_not_found',
      });
    }
  }

  /**
   * Validate status ID format - accepts both standard UUID and custom formats
   */
  private isValidStatusId(statusId: string): boolean {
    // Check if it's a standard UUID
    if (isUUID(statusId)) {
      return true;
    }

    // Check if it's a UUID-like format (8-4-4-4-12 characters)
    const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidLikePattern.test(statusId);
  }
}
