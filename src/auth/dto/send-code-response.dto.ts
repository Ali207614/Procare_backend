import { ApiProperty } from '@nestjs/swagger';

export class SendCodeResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Verification code sent successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Code expiration time in seconds',
    example: 300,
  })
  expires_in!: number;

  @ApiProperty({
    description: 'Code expiration timestamp',
    example: '2024-03-20T10:05:00.000Z',
  })
  expires_at!: string;

  @ApiProperty({
    description: 'Time to wait before retrying in seconds',
    example: 60,
  })
  retry_after!: number;

  @ApiProperty({
    description: 'Verification code (only returned in non-production environments)',
    example: '123456',
    required: false,
  })
  code?: string;
}
