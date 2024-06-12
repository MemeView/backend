import { Controller, Post, Body, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { addDays, addMonths, addYears, format } from 'date-fns';
import { TradeBotService } from '../trade-bot/trade-bot.service';
import { PrismaClient } from '@prisma/client';
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import * as crypto from 'crypto';

@Controller('api')
export class CryptomusController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tradeBotService: TradeBotService,
  ) {}

  @Post('cryptomus-webhook')
  async handleWebhook(@Body() body: any, @Res() res: Response) {
    console.log(body);

    // const { result } = body;
    // const { order_id, payment_status } = result;

    const { order_id, status } = body;

    if (status !== 'paid' && status !== 'paid_over') {
      return res.status(HttpStatus.OK).send();
    }

    const match = order_id.match(/^(\d+)_(1_Week|1_Month|1_Year)_\d+$/);
    if (!match) {
      return res.status(HttpStatus.BAD_REQUEST).send('Invalid order ID format');
    }

    const chatId = match[1];
    const title = match[2];
    const utcNow = new Date();

    let newExpiryDate;
    if (title === '1_Week') {
      newExpiryDate = addDays(utcNow, 7);
    } else if (title === '1_Month') {
      newExpiryDate = addMonths(utcNow, 1);
    } else if (title === '1_Year') {
      newExpiryDate = addYears(utcNow, 1);
    }

    let user = await this.prisma.tradingBotUsers.findUnique({
      where: { telegramId: chatId },
    });

    if (user) {
      // Если подписка пользователя еще активна, добавляем время к текущей дате окончания подписки
      if (
        user.tradingBotSubscriptionExpiresAt &&
        user.tradingBotSubscriptionExpiresAt > utcNow
      ) {
        const currentExpiryDate = new Date(
          user.tradingBotSubscriptionExpiresAt,
        );
        if (title === '1_Week') {
          newExpiryDate = addDays(currentExpiryDate, 7);
        } else if (title === '1_Month') {
          newExpiryDate = addMonths(currentExpiryDate, 1);
        } else if (title === '1_Year') {
          newExpiryDate = addYears(currentExpiryDate, 1);
        }
      }
      user = await this.prisma.tradingBotUsers.update({
        where: { telegramId: chatId },
        data: {
          tradingBotSubscription: true,
          tradingBotSubscriptionExpiresAt: newExpiryDate,
        },
      });
    } else {
      user = await this.prisma.tradingBotUsers.upsert({
        where: { telegramId: chatId },
        update: {
          tradingBotSubscription: true,
          tradingBotSubscriptionExpiresAt: newExpiryDate,
        },
        create: {
          telegramId: chatId,
          tradingBotSubscription: true,
          tradingBotSubscriptionExpiresAt: newExpiryDate,
        },
      });
    }

    await this.prisma.cryptomusTransactions.update({
      where: {
        orderId: order_id,
      },
      data: {
        isFinal: true,
      },
    });

    const formattedExpiryDate = format(newExpiryDate, 'MMMM d, yyyy');
    const messageText = `*Purchase complete*\n\nYour plan has been activated till ${formattedExpiryDate}.\n\nGo get the latest signals.`;

    const tradeBot = TradeBotService.getBotInstance();
    await tradeBot.sendMessage(chatId, messageText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🚀 Get Top-30 Tokens',
              callback_data: 'top30',
            },
          ],
        ],
      },
    });

    return res.status(HttpStatus.OK).send();
  }

  @Post('test-cryptomus-webhook')
  async testWebhook(@Body() data: any, @Res() res: Response) {
    const { uuid, order_id, status, currency, network, url_callback } = data;

    const cryptomusApiUrl = 'https://api.cryptomus.com/v1/test-webhook/payment';
    const merchant = process.env.CRYPTOMUS_MERCHANT;
    const apiKey = process.env.CRYPTOMUS_API_KEY;

    const requestData = {
      uuid,
      order_id,
      status,
      currency,
      network,
      url_callback,
    };

    const dataString = JSON.stringify(requestData);

    const base64Data = Buffer.from(dataString).toString('base64');

    // Генерация подписи
    const sign = crypto
      .createHash('md5')
      .update(base64Data + apiKey)
      .digest('hex');

    try {
      const response = await axios.post(cryptomusApiUrl, requestData, {
        headers: {
          merchant: merchant,
          sign: sign,
          'Content-Type': 'application/json',
        },
      });

      console.log(response.data);
      return res.status(HttpStatus.OK).json(response.data);
    } catch (error) {
      console.error('Error testing Cryptomus webhook:', error);
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Error testing Cryptomus webhook' });
    }
  }
}
