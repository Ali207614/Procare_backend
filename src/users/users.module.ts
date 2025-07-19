import { UsersService } from './users.service';
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { PermissionsModule } from 'src/permissions/permissions.module';
import { SapModule } from 'src/sap/sap.module';

@Module({
  imports: [SapModule, PermissionsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
