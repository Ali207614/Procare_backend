import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBasicAuth } from '@nestjs/swagger';
import { OnlinePbxService } from './online-pbx.service';
import { OnlinePbxAuthGuard } from './online-pbx-auth.guard';

@ApiTags('OnlinePBX (Webhooks)')
@ApiBasicAuth()
@UseGuards(OnlinePbxAuthGuard)
@Controller('api/webhooks/online-pbx')
export class OnlinePbxController {
  constructor(private readonly onlinePbxService: OnlinePbxService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Catch webhooks from OnlinePBX system' })
  async handleWebhook(@Body() payload: Record<string, unknown>): Promise<{ status: string }> {
    await this.onlinePbxService.handleWebhook(payload);
    return { status: 'ok' };
  }
}
