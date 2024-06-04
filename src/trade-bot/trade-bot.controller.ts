import { Body, Controller, Post } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TradeBotService } from './trade-bot.service';
import { UTCDate } from '@date-fns/utc';
import { addWeeks, addYears } from 'date-fns';

@Controller('api')
export class TradeBotController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tradeBotService: TradeBotService,
  ) {}

  @Post('/take-subscription-list')
  async takeSubscriptionList(@Body('telegramIds') telegramIds: string[]) {
    const utcDate = new Date();
    const subscriptionExpiryDate = addYears(utcDate, 10);

    const existingUsers = await this.prisma.tradingBotUsers.findMany({
      where: {
        telegramId: {
          in: telegramIds,
        },
      },
      select: {
        telegramId: true,
      },
    });

    // Собираю массив существующих Telegram ID
    const existingTelegramIds = existingUsers.map((user) => user.telegramId);

    // Удаляю существующие записи
    if (existingTelegramIds.length > 0) {
      await this.prisma.tradingBotUsers.deleteMany({
        where: {
          telegramId: {
            in: existingTelegramIds,
          },
        },
      });
    }

    const newUsersData = telegramIds.map((telegramId) => ({
      telegramId,
      tradingBotSubscription: true,
      tradingBotSubscriptionExpiresAt: subscriptionExpiryDate,
    }));

    const newSubscriptions = await this.prisma.tradingBotUsers.createMany({
      data: newUsersData,
    });

    return newSubscriptions;
  }
}
