import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { HistoryModule } from 'src/history/history.module';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PermissionsModule, RedisModule, HistoryModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
