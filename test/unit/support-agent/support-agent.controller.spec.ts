import { SupportAgentController } from 'src/support-agent/support-agent.controller';
import { BadRequestException } from '@nestjs/common';
import {
  APPLICATION_SEND_CONVERSATION_KEY,
  SEND_APPLICATION_TO_CRM_FUNCTION_NAME,
  SUPPORT_AGENT_FUNCTIONS,
  SUPPORT_AGENT_SYSTEM_INSTRUCTIONS,
} from 'src/support-agent/support-agent.constants';

describe('SupportAgentController', () => {
  let controller: SupportAgentController;

  beforeEach(() => {
    controller = new SupportAgentController();
  });

  it('returns zero-property function schema in instructions', () => {
    const result = controller.getInstructions();

    expect(result.system_instructions).toBe(SUPPORT_AGENT_SYSTEM_INSTRUCTIONS);
    expect(result.functions).toBe(SUPPORT_AGENT_FUNCTIONS);
    expect(result.functions[0].function.name).toBe(SEND_APPLICATION_TO_CRM_FUNCTION_NAME);
    expect(result.functions[0].function.parameters).toEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
      required: [],
    });
  });

  it('returns a support-ticket close and application-conversation handoff signal', () => {
    expect(controller.sendApplicationToCrm()).toEqual({
      function_name: SEND_APPLICATION_TO_CRM_FUNCTION_NAME,
      close_support_ticket: true,
      next_conversation: APPLICATION_SEND_CONVERSATION_KEY,
      crm_submission: 'deferred_to_bot_application_conversation',
      message:
        'Close the support ticket and start the bot application-send conversation. Do not collect application fields inside the support ticket.',
    });
  });

  it('rejects function arguments because the function has zero properties', () => {
    expect(() =>
      controller.sendApplicationToCrm({ product: 'iPhone' } as unknown as Record<string, never>),
    ).toThrow(BadRequestException);
  });
});
