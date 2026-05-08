import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsService } from './sms.service';
import { OtpService } from './otp.service';

@Module({
  imports: [ConfigModule],
  providers: [SmsService, OtpService],
  exports: [SmsService, OtpService],
})
export class ServicesModule {}
