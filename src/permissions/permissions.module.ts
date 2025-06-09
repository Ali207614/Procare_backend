import { Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { RedisModule } from 'src/common/redis/redis.module';
import { KnexModule } from 'nestjs-knex';

@Module({
    imports: [
        RedisModule,
    ],
    providers: [
        PermissionsService,
    ],
    exports: [
        PermissionsService,
    ],
})
export class PermissionsModule { }
