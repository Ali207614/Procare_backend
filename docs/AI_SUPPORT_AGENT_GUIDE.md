# AI Support Agent CRM Application Handoff

The support agent has one zero-property function for confirmed purchase requests:

```json
{
  "type": "function",
  "function": {
    "name": "send_application_to_crm",
    "description": "Close the current support ticket and start the bot conversation that sends a confirmed product purchase application to CRM. Use only after the customer agrees to buy a specific product.",
    "parameters": {
      "type": "object",
      "properties": {},
      "additionalProperties": false,
      "required": []
    }
  }
}
```

Runtime endpoint:

`POST /api/v1/support-agent/send-application-to-crm`

The endpoint accepts no properties. It returns a handoff signal telling the bot runtime to close the support ticket and start the real application-send conversation.

System instruction boundary:

- Trigger `send_application_to_crm` only when the customer is asking to buy a specific product and agrees to proceed.
- Treat it as an application when the customer agrees to buy a specific product.
- Treat it as a support message when the customer has an issue, complaint, repair/service question, pricing question, warranty question, delivery question, or another topic without a clear need to buy.
- Do not trigger application sending for general interest, browsing, comparisons, availability checks, price questions, or ambiguous intent.
- If intent is ambiguous, ask one short clarifying question first.

The current instructions and function schema are also available at:

`GET /api/v1/support-agent/instructions`
