import { Module, forwardRef } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { RedisModule } from 'src/common/redis/redis.module';
import { PermissionsModule } from 'src/permissions/permissions.module';

@Module({
    imports: [
        RedisModule,
        PermissionsModule
    ],
    controllers: [RolesController],
    providers: [RolesService],
    exports: [RolesService],
})
export class RolesModule { }
