import { Module } from '@nestjs/common';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  providers: [NotificationGateway, NotificationService],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
