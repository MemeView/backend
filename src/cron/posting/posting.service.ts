import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import { id } from 'date-fns/locale';
import axios from 'axios';
import { subHours } from 'date-fns';
import { TwitterApi } from 'twitter-api-v2';
import { join } from 'path';
import * as fs from 'fs';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

@Injectable()
export class PostingService {
  constructor(private prisma: PrismaClient) {}

  getAbsoluteScore(absoluteScore: number): string {
    const parts = String(absoluteScore).split('.'); // Разделяем число на целую и десятичную части

    const integerPart = parts[0];

    const decimalPart = parts[1];

    if (decimalPart) {
      return `${integerPart}.${decimalPart[0]}`;
    }

    return absoluteScore.toFixed(1).toString();
  }

  async sendTwitterMessage(message, twitterPhotoPath) {
    try {
      const mediaId = await twitterClient.v1.uploadMedia(twitterPhotoPath, {mimeType: 'image/jpeg'});
      const tweet = await twitterClient.v2.tweet(message, {
        media: { media_ids: [mediaId] },
      });
      console.log('Twitter message with image sent successfully!', tweet);
    } catch (error) {
      console.error('Failed to send Twitter message with image:', error);
      if (error.data) {
        console.error(JSON.stringify(error.data, null, 2));
      }
    }
  }

  async sendTelegramMessage(message: string, photoPath: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const bot = new TelegramBot(botToken);

    try {
      await bot.sendPhoto(chatId, photoPath, {
        caption: message,
        parse_mode: 'Markdown',
      });
      console.log('Telegram photo message sent successfully!');
    } catch (error) {
      console.error('Failed to send Telegram photo message:', error);
    }
  }

  pendingTelegramMessages = [];

  async fetchDataByTokenAddress(tokenAddress: string) {
    const dailyScoresPromise = this.prisma.dailyScore.findUnique({
      where: { tokenAddress: tokenAddress },
    });
    const scorePromise = this.prisma.score.findUnique({
      where: { tokenAddress: tokenAddress },
    });

    const [dailyScore, score] = await Promise.all([
      dailyScoresPromise,
      scorePromise,
    ]);

    const averageScoreToday = dailyScore?.averageScoreToday;
    const tokenScore = score?.tokenScore;

    return { averageScoreToday, score: tokenScore };
  }

  async handleCombinedPosting() {
    const bestByChange24 = await this.prisma.tokens.findMany({
      where: {
        AND: [{ change24: { gte: '0.5' } }, { liquidity: { gte: '3000' } }],
      },
      orderBy: {
        change24: 'desc',
      },
      select: {
        address: true,
        symbol: true,
        change24: true,
        quoteToken: true,
        pairAddress: true,
      },
    });

    const now = new Date();
    const twentyFourHoursAgo = subHours(now, 24);

    await this.prisma.postedTokens.deleteMany({
      where: { createdAt: { lt: twentyFourHoursAgo } },
    });

    const postedTokensAddresses = await this.prisma.postedTokens.findMany({
      select: {
        tokenAddress: true,
      },
    });

    const postedAddresses = new Set(
      postedTokensAddresses.map((token) => token.tokenAddress),
    );
    let messagesCount = 0;

    for (const token of bestByChange24) {
      if (postedAddresses.has(token.address)) {
        continue; // Пропускаем уже разосланные
      }

      const { averageScoreToday, score } = await this.fetchDataByTokenAddress(
        token.address,
      );

      if (
        token.address &&
        token.pairAddress &&
        token.change24 &&
        token.symbol &&
        token.quoteToken &&
        averageScoreToday !== undefined &&
        score !== undefined &&
        averageScoreToday >= 40 &&
        messagesCount < 3
      ) {
        // Создаем сообщение для отправки
        const growth = parseFloat(token.change24) * 100;
        const message =
          `[$${token.symbol.toUpperCase()}](https://tokenwatch.ai/en/tokens/${
            token.pairAddress
          }?quoteToken=${token.quoteToken}) \n\n` +
          `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
          `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
            averageScoreToday,
          )}\n\n` +
          `#${token.symbol.toUpperCase()} ` +
          `#${token.symbol.toUpperCase()}growth ` +
          `#TokenWatch`;

        // Отправляем сообщение в Телеграм
        const photoPath =
          'https://tokenwatch.ai/assets/tokenwatch_post_standard.jpg';
        await this.sendTelegramMessage(message, photoPath);

        // Отправляем твит
        const twitterPhotoPath = await axios.get(photoPath, {responseType: 'arraybuffer'});

        await this.sendTwitterMessage(message, twitterPhotoPath.data);

        // Отмечаем токен как разосланный
        await this.prisma.postedTokens.create({
          data: {
            tokenAddress: token.address,
          },
        });

        messagesCount++;
      }
      console.log('==================');
      console.log('tokenAddress', token.address);
      console.log('change24', token.change24);
      console.log('symbol', token.symbol);
      console.log('averageScoreYesterday', averageScoreToday);
      console.log('score', score);
      console.log('==================');
    }
  }

  //   private readonly bot: TelegramBot;
  //   private readonly chatIdCollection: number[] = [];
  //   constructor(private prisma: PrismaClient) {
  //     const botToken = '6748950090:AAGPmiQsv-kyAjrTLnwoO3o0E37tvgD69-M';
  //     this.bot = new TelegramBot(botToken, { polling: true });
  //     this.listenForCommands();
  //   }
  //   private listenForCommands() {
  //     this.bot.onText(/\/start/, async (msg) => {
  //       const chatId = msg.chat.id;
  //       const user = await this.prisma.telegramBotUsers.findUnique({
  //         where: { id: chatId },
  //       });
  //       if (!user) {
  //         await this.prisma.telegramBotUsers.create(chatId);
  //       }
  //       this.bot.sendMessage(
  //         chatId,
  //         'Добро пожаловать! Вы были добавлены в список рассылки.',
  //       );
  //     });
  //     this.bot.onText(/\/stop/, async (msg) => {
  //       const chatId = msg.chat.id;
  //       this.bot.sendMessage(chatId, 'Вы были удалены из списка рассылки.');
  //     });
  //   }
  //   async sendTelegramMessageToAllUsers(finalResults: any[]) {
  //     for (const chatId of this.chatIdCollection) {
  //       for (const result of finalResults) {
  //         const message = `tokenAddress: ${result.tokenAddress}, symbol: ${result.symbol}, change24: ${result.change24}, averageScoreYesterday: ${result.averageScoreYesterday}, score: ${result.score}`;
  //         this.bot.sendMessage(chatId, message);
  //       }
  //     }
  //   }
}
