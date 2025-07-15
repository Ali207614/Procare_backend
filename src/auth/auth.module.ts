import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from 'src/common/redis/redis.module';
import { FeatureModule } from 'src/feature/feature.module';
import { AdminsModule } from 'src/admins/admins.module';
import { JwtAdminStrategy } from 'src/common/strategies/jwt-admin.strategy';
import { JwtAdminAuthGuard } from 'src/common/guards/jwt-admin.guard';

@Module({
  imports: [
    AdminsModule,
    ConfigModule,
    RedisModule,
    FeatureModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtAdminStrategy, JwtAdminAuthGuard],
  exports: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
