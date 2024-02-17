import { Controller, Get, Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SignalBotService } from './signal-bot.service';

@Controller('/api')
export class SignalBotController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalBotService: SignalBotService,
  ) {}

  @Post('/check-subscription-to-channel')
  async checkSubscriptionToChannel() {
    try {
      const username = '1161414429';
      const channelId = 'TokenWatch_ai';

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
