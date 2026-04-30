import { ApiProperty } from '@nestjs/swagger';

export class SupportAgentActionResponseDto {
  @ApiProperty({ example: 'send_application_to_crm' })
  function_name!: string;

  @ApiProperty({ example: true })
  close_support_ticket!: boolean;

  @ApiProperty({ example: 'application_send' })
  next_conversation!: string;

  @ApiProperty({ example: 'deferred_to_bot_application_conversation' })
  crm_submission!: string;

  @ApiProperty({
    example:
      'Close the support ticket and start the bot application-send conversation. Do not collect application fields inside the support ticket.',
  })
  message!: string;
}
