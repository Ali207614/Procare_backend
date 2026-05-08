import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import {
  APPLICATION_SEND_CONVERSATION_KEY,
  SEND_APPLICATION_TO_CRM_FUNCTION_NAME,
  SUPPORT_AGENT_FUNCTIONS,
  SUPPORT_AGENT_SYSTEM_INSTRUCTIONS,
} from './support-agent.constants';
import { SupportAgentActionResponseDto } from './dto/support-agent-action-response.dto';

@ApiTags('AI Support Agent')
@Controller('support-agent')
export class SupportAgentController {
  @Get('instructions')
  @ApiOperation({
    summary: 'Get AI support agent instructions and callable functions',
    operationId: 'getSupportAgentInstructions',
    description:
      'Returns the system instructions and function schema used by the AI-powered support agent.',
  })
  @ApiProduces('application/json')
  @ApiOkResponse({
    description: 'Support agent instructions and zero-property function schema.',
    schema: {
      type: 'object',
      properties: {
        system_instructions: { type: 'string' },
        functions: {
          type: 'array',
          items: { type: 'object' },
        },
      },
    },
  })
  getInstructions(): {
    system_instructions: string;
    functions: typeof SUPPORT_AGENT_FUNCTIONS;
  } {
    return {
      system_instructions: SUPPORT_AGENT_SYSTEM_INSTRUCTIONS,
      functions: SUPPORT_AGENT_FUNCTIONS,
    };
  }

  @Post('send-application-to-crm')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Close support ticket and start CRM application bot flow',
    operationId: SEND_APPLICATION_TO_CRM_FUNCTION_NAME,
    description: [
      'Zero-property function endpoint for the AI-powered support agent.',
      '',
      'Call this only when the customer is asking to buy a specific product and agrees to proceed.',
      'The support ticket should be closed after this action, and the bot should start the real application-send conversation that collects/submits CRM application data.',
      '',
      'Do not call this for support issues, complaints, product questions, repair questions, pricing questions, warranty questions, or ambiguous messages where the customer has not agreed to buy a specific product.',
    ].join('\n'),
  })
  @ApiBody({
    required: false,
    description: 'No properties are accepted or required. Send an empty JSON object or no body.',
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  })
  @ApiProduces('application/json')
  @ApiOkResponse({
    description:
      'Handoff signal returned to the support agent runtime. The bot layer should close the support ticket and start the application-send conversation.',
    type: SupportAgentActionResponseDto,
  })
  sendApplicationToCrm(@Body() _body?: Record<string, never>): SupportAgentActionResponseDto {
    if (_body && Object.keys(_body).length > 0) {
      throw new BadRequestException({
        message: 'send_application_to_crm does not accept any properties',
        error: 'ValidationError',
        location: 'body',
      });
    }

    return {
      function_name: SEND_APPLICATION_TO_CRM_FUNCTION_NAME,
      close_support_ticket: true,
      next_conversation: APPLICATION_SEND_CONVERSATION_KEY,
      crm_submission: 'deferred_to_bot_application_conversation',
      message:
        'Close the support ticket and start the bot application-send conversation. Do not collect application fields inside the support ticket.',
    };
  }
}
