import { Module } from '@nestjs/common';
import { RedisModule } from 'src/common/redis/redis.module';
import { AdminsController } from './admins.controller';
import { AdminsService } from './admins.service';

@Module({
    imports: [RedisModule],
    controllers: [AdminsController],
    providers: [AdminsService],
    exports: [AdminsService, AdminsModule],
})
export class AdminsModule { }

