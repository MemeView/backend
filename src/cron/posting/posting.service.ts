import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { subHours } from 'date-fns';
import { TwitterApi } from 'twitter-api-v2';
import * as nodemailer from 'nodemailer';
import * as moment from 'moment/moment';

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
      const mediaId = await twitterClient.v1.uploadMedia(twitterPhotoPath, {
        mimeType: 'image/jpeg',
      });
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

  async sendEmailMessage(message) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'hotmail',
        auth: {
          user: process.env.MAIL_SENDER_LOGIN,
          pass: process.env.MAIL_SENDER_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.MAIL_SENDER_LOGIN,
        to: process.env.MAIL_RECEIVER_LOGIN,
        subject: `${moment(new Date()).format(
          'YYYY.MM.DD',
        )} Tokens Information`,
        text: message,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log('sendMail', error);
        }
        console.log('Message sent: %s', info.messageId);
      });
    } catch (error) {
      console.log(error);
    }
  }

  async handleCombinedPosting() {
    try {
      const bestByChange24 = await this.prisma.tokens.findMany({
        where: {
          AND: [{ change24: { gte: '0.5' } }, { liquidity: { gte: '10000' } }],
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

      const tokenAddresses = bestByChange24.map((token) => token.address);

      const scores = await this.prisma.dailyScore.findMany({
        where: {
          tokenAddress: {
            in: tokenAddresses,
          },
        },
        select: {
          tokenAddress: true,
          averageScoreToday: true,
        },
      });

      const mergedTokens = [];

      scores.forEach((score) => {
        const token = bestByChange24.find(
          (token) => token.address === score.tokenAddress,
        );

        if (
          token &&
          score.averageScoreToday !== undefined &&
          token.symbol &&
          token.address &&
          token.change24 &&
          token.pairAddress &&
          token.quoteToken
        ) {
          mergedTokens.push({
            ...token,
            averageScoreToday: score.averageScoreToday,
          });
        }
      });

      const sortedByScore = mergedTokens.sort(
        (a, b) => b.averageScoreToday - a.averageScoreToday,
      );

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

      const tokenDataArray = [];

      for (const token of sortedByScore) {
        if (
          postedAddresses.has(token.address) ||
          parseFloat(token.change24) * 100 >= 200
        ) {
          continue; // Пропускаем уже разосланные
        }

        const tokenData = {
          address: token.address,
          pairAddress: token.pairAddress,
          change24: token.change24,
          symbol: token.symbol,
          averageScoreToday: this.getAbsoluteScore(
            parseFloat(token.averageScoreToday),
          ),
        };

        tokenDataArray.push(tokenData);

        if (messagesCount < 2 && token.averageScoreToday >= 60) {
          // Создаем сообщение для отправки
          const growth = parseFloat(token.change24) * 100;
          const message =
            `[$${token.symbol.toUpperCase()}](https://tokenwatch.ai/en/tokens/${
              token.pairAddress
            }?quoteToken=${token.quoteToken}) \n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              token.averageScoreToday,
            )}\n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch`;

          const twitterMessage =
            `$${token.symbol.toUpperCase()}\n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              parseFloat(token.averageScoreToday),
            )}\n\n` +
            `🌐 https://tokenwatch.ai/en/tokens/${token.pairAddress}?quoteToken=${token.quoteToken} \n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch`;

          // Отправляем сообщение в Телеграм
          const photoPath =
            'https://tokenwatch.ai/assets/tokenwatch_post_standard.jpg';
          await this.sendTelegramMessage(message, photoPath);

          // Отправляем твит
          const twitterPhotoPath = await axios.get(photoPath, {
            responseType: 'arraybuffer',
          });

          await this.sendTwitterMessage(twitterMessage, twitterPhotoPath.data);

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
        console.log('averageScoreYesterday', token.averageScoreToday);
        console.log('==================');
      }

      //   const emailMessage = tokenDataArray
      //     .map(
      //       (token) => `
      //   Token Symbol: ${token.symbol}
      //   Address: ${token.address}
      //   Pair Address: ${token.pairAddress}
      //   Change (24H): ${token.change24}
      //   Average Score Yesterday: ${token.averageScoreToday}
      // `,
      //     )
      //     .join('\n');

      // await this.sendEmailMessage(emailMessage);
    } catch (error) {
      console.log(error);
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
