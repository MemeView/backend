import { Controller, Get } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SignalBotService } from './signal-bot.service';

@Controller('/api')
export class SignalBotController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalBotService: SignalBotService,
  ) {}

  @Get('/check-subscription-to-channel')
  async checkSubscriptionToChannel() {
    try {
      const username = 'BIBO_Baggins';
      const channelId = '-1001880299449';

      const result = await this.signalBotService.checkSubscriptionByUsername(
        username,
        channelId,
      );

      return result;
    } catch (e) {
      return e;
    }
  }
}
