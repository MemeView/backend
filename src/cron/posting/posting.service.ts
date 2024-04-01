import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';
import { TwitterApi } from 'twitter-api-v2';
import * as nodemailer from 'nodemailer';
import * as moment from 'moment/moment';
import { UTCDate } from '@date-fns/utc';
import * as path from 'path';
import * as fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

interface mergedToken {
  address: string;
  symbol: string;
  quoteToken: string;
  change24: string;
  pairAddress: string;
  networkId: number;
  twitterUrl: string;
  averageScoreToday: string;
}

@Injectable()
export class PostingService {
  constructor(private prisma: PrismaClient) {}

  async addTextToImage(imagePath, text) {
    const canvas = createCanvas(1200, 675);
    const ctx = canvas.getContext('2d');

    const image = await loadImage(imagePath);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    ctx.font = 'bold 250px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center'; // Выравнивание текста по центру
    ctx.textBaseline = 'middle'; // Выравнивание текста по вертикали по центру

    // Рассчитываем координаты
    const textWidth = ctx.measureText(text).width;
    const xPosition = (canvas.width - textWidth) / 2;
    const yPosition = canvas.height / 2 - 130;

    ctx.fillText(text, xPosition + textWidth / 2, yPosition);

    return canvas.toBuffer();
  }

  getAbsoluteScore(absoluteScore: number): string {
    const parts = String(absoluteScore).split('.'); // Разделяем число на целую и десятичную части

    const integerPart = parts[0];

    const decimalPart = parts[1];

    if (decimalPart) {
      return `${integerPart}.${decimalPart[0]}`;
    }

    return absoluteScore.toFixed(1).toString();
  }

  async sendTwitterMessage(message: string) {
    try {
      const tweet = await twitterClient.v2.tweet(message);
      console.log('Twitter message sent successfully!', tweet);
    } catch (error) {
      console.error('Failed to send Twitter message:', error);
      if (error.data) {
        console.error(JSON.stringify(error.data, null, 2));
      }
    }
  }

  async sendTelegramMessage(message) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const bot = new TelegramBot(botToken, {
      polling: false,
    });

    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      console.log('Telegram message sent successfully!');
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  async sendTelegramPhoto(message: string, image: string, chatId: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    // const chatId = process.env.TELEGRAM_CHAT_ID;
    const bot = new TelegramBot(botToken, {
      polling: false,
    });

    try {
      await bot.sendPhoto(chatId, image, {
        caption: message,
        parse_mode: 'Markdown',
      });
      console.log('Telegram message with image sent successfully!');
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  async sendTwitterPhoto(message, imageUrl: string) {
    try {
      const mediaId = await twitterClient.v1.uploadMedia(imageUrl, {
        mimeType: 'image/jpeg',
      });

      const tweet = await twitterClient.v2.tweet(message, {
        media: { media_ids: [mediaId] },
      });

      console.log('Twitter message sent successfully!');
    } catch (error) {
      console.error('Failed to send Twitter message:', error);
      if (error.errors) {
        console.error('Twitter API errors:', error.errors);
      }
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
          networkId: true,
          twitterUrl: true,
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

      const mergedTokens: mergedToken[] = [];

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
            averageScoreToday: JSON.stringify(score.averageScoreToday),
          });
        }
      });

      const sortedByScore = mergedTokens.sort(
        (a, b) =>
          parseFloat(b.averageScoreToday) - parseFloat(a.averageScoreToday),
      );

      const utcDate = new UTCDate();

      const twentyFourHoursAgo = subHours(utcDate, 24);

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

        let network: string;

        if (token.networkId === 1) {
          network = 'eth';
        }

        if (token.networkId === 56) {
          network = 'bsc';
        }

        if (messagesCount < 2 && parseFloat(token.averageScoreToday) >= 50) {
          // Создаем сообщение для отправки
          const growth = parseFloat(token.change24) * 100;
          let tokenTwitterUrl = null;
          if (token.twitterUrl) {
            tokenTwitterUrl = token.twitterUrl.split('https://twitter.com/');
          }
          const message =
            `[$${token.symbol.toUpperCase()}](https://tokenwatch.ai/en/tokens/${network}/${
              token.pairAddress
            }?quoteToken=${token.quoteToken}) \n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              parseFloat(token.averageScoreToday),
            )}\n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch`;

          const testMessage =
            `$${token.symbol.toUpperCase()}\n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              parseFloat(token.averageScoreToday),
            )}\n\n` +
            `🌐 https://tokenwatch.ai/en/tokens/${network}/${token.pairAddress}?quoteToken=${token.quoteToken} \n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch ` +
            `#CryptoCurrency ` +
            `#CryptoMarket ` +
            `#ToTheMoonScore ` +
            `#TTMS ` +
            `#Signals\n\n` +
            `by @TokenWatch\\_ai`;

          let twitterTestMessage =
            `$${token.symbol.toUpperCase()}\n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              parseFloat(token.averageScoreToday),
            )}\n\n` +
            `🌐 https://tokenwatch.ai/en/tokens/${network}/${token.pairAddress}?quoteToken=${token.quoteToken} \n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch ` +
            `#CryptoCurrency ` +
            `#CryptoMarket ` +
            `#ToTheMoonScore ` +
            `#TTMS ` +
            `#Signals\n\n` +
            `by @TokenWatch_ai`;

          if (tokenTwitterUrl) {
            twitterTestMessage =
              `@${tokenTwitterUrl[1]}\n` + twitterTestMessage;
          }

          const twitterMessage =
            `$${token.symbol.toUpperCase()}\n\n` +
            `💹 24h growth: +${this.getAbsoluteScore(growth)}%\n\n` +
            `🚀 Yesterday ToTheMoonScore: ${this.getAbsoluteScore(
              parseFloat(token.averageScoreToday),
            )}\n\n` +
            `🌐 https://tokenwatch.ai/en/tokens/${network}/${token.pairAddress}?quoteToken=${token.quoteToken} \n\n` +
            `#${token.symbol.toUpperCase()} ` +
            `#${token.symbol.toUpperCase()}growth ` +
            `#TokenWatch`;

          // Отправляем сообщение в Телеграм
          // const photoPath =
          //   'https://tokenwatch.ai/assets/tokenwatch_post_standard.jpg';
          // await this.sendTelegramMessage(message);
          await this.sendTelegramMessage(testMessage);

          // Отправляем твит
          // const twitterPhotoPath = await axios.get(photoPath, {
          //   responseType: 'arraybuffer',
          // });

          // await this.sendTwitterMessage(twitterMessage);
          await this.sendTwitterMessage(twitterTestMessage);

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
  async portfolioAutoPosting() {
    try {
      const lastAveragePortfolio =
        await this.prisma.averageTtmsPortfolioResults.findFirst({
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            average24Result: true,
          },
        });

      if (parseFloat(lastAveragePortfolio.average24Result) > 1) {
        const telegramMessage = `💹 24h portfolio growth: +${parseFloat(
          lastAveragePortfolio.average24Result,
        ).toFixed(2)}% 🚀

Details 👉 https://tokenwatch.ai/en/investment-results

Start Signal Bot ⏩ https://t.me/TokenWatch\\_SignalBot

#TokenWatch #TokenGrowth #CryptoCurrency #CryptoMarket #Signals #AI #CryptoAI #ToTheMoonScore #TTMS`;

        const twitterMessage = `💹 24h portfolio growth: +${parseFloat(
          lastAveragePortfolio.average24Result,
        ).toFixed(2)}% 🚀

Details 👉 https://tokenwatch.ai/en/investment-results

Start Signal Bot ⏩ https://t.me/TokenWatch_SignalBot

#TokenWatch #TokenGrowth #CryptoCurrency #CryptoMarket #Signals #AI #CryptoAI #ToTheMoonScore #TTMS`;

        const imagePath = path.join(
          __dirname,
          '../../../..',
          'public/images',
          'tokenwatch_post_standard.png',
        );
        console.log(imagePath);

        fs.readFile(imagePath, async (err, data) => {
          if (err) {
            console.error(err);
            return;
          }
          const modifiedImage = await this.addTextToImage(
            data,
            `+${parseFloat(lastAveragePortfolio.average24Result).toFixed(2)}%`,
          );

          fs.writeFileSync('modified_image.png', modifiedImage);

          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.TELEGRAM_CHAT_ID,
          );
          await this.sendTwitterPhoto(twitterMessage, 'modified_image.png');

          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.TELEGRAM_TOKENWATCH_AI_ID,
          );
          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.CHAT_RU_ID,
          );
          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.CHAT_AR_ID,
          );
          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.CHAT_ES_ID,
          );
          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.CHAT_PT_ID,
          );
          await this.sendTelegramPhoto(
            telegramMessage,
            'modified_image.png',
            process.env.CHAT_ZH_ID,
          );
        });
      }

      return 'ok';
    } catch (error) {
      return error;
    }
  }
}
