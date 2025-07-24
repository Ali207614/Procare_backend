import { UsersService } from './users.service';
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { SapModule } from 'src/sap/sap.module';
import { RedisModule } from 'src/common/redis/redis.module';

@Module({
  imports: [SapModule, PermissionsModule,RedisModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
