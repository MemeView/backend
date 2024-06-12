import { UTCDate } from '@date-fns/utc';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  subDays,
  subHours,
  format,
  differenceInMinutes,
  startOfDay,
  addDays,
  addMonths,
  addYears,
} from 'date-fns';
import * as TelegramBot from 'node-telegram-bot-api';
import * as initData from '@tma.js/init-data-node';
import axios from 'axios';
import * as crypto from 'crypto';
// import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class TradeBotService {
  private static bot: TelegramBot;
  private authorizedUsers: Set<number>; // множество для хранения id авторизованных пользователей

  constructor(
    private readonly prisma: PrismaClient, // private readonly authService: AuthService,
  ) {
    if (!TradeBotService.bot) {
      TradeBotService.bot = new TelegramBot(process.env.TG_TRADE_BOT_TOKEN, {
        polling: true,
      });
    }

    const telegramBot = TradeBotService.bot;
    this.authorizedUsers = new Set();
    let userId = 0;
    let botUsername;
    const paymentToken = 'PAYMENT_TOKEN';

    telegramBot.getMe().then((botInfo) => {
      botUsername = botInfo.username;
    });

    telegramBot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;

      const userId = msg.from.id;

      const user = await telegramBot.getChat(userId);

      const userName = user.username;

      const buttons = [
        [
          {
            text: '🚀 Get Top-30 Tokens',
            callback_data: 'top30',
          },
        ],
        [
          {
            text: '🔥 Trading Bots',
            callback_data: 'tradingBots',
          },
        ],
        [
          {
            text: '👤 My Plan',
            callback_data: 'myPlan',
          },
          { text: 'ℹ️ About', callback_data: 'about' },
        ],
      ];

      const replyMarkup = {
        keyboard: buttons,
        resize_keyboard: true,
      };

      const options = {
        reply_markup: replyMarkup,
        disable_notification: true,
      };

      const welcomeMessage = `Hi there!
Welcome to the TokenWatch AI bot 👋
      
Tap one of the buttons below:
      
🚀 Get Top-30 Tokens - receive Top-30 tokens predictions 2 times a day on the several blockchains.
      
👤 My Plan - choose your subscription plan and check your current Plan status.
      
ℹ️ About - more info about TokenWatch AI predictions.
      
We are here to help your daily tokens investment decisions become smarter 🧠
      
To get your first Top-30 tokens predictions buy a plan in the My Plan section.`;

      telegramBot.sendMessage(chatId, welcomeMessage, options);
    });

    telegramBot.onText(/ℹ️ About/, (msg) => {
      const chatId = msg.chat.id;
      const firstMessageButtons = [
        [{ text: '🌐 Website', url: 'https://tokenwatch.ai/en' }],
        [{ text: '🐦 Twitter', url: 'https://twitter.com/TokenWatch_ai' }],
        [
          {
            text: '📣 Telegram',
            callback_data: 'telegramButton',
            // url: 'https://t.me/TokenWatch_ai',
          },
        ],
        [{ text: '❓ Support', callback_data: 'supportButton' }],
      ];

      const secondMessageButtons = [
        [
          {
            text: '🌐 Investments Results',
            url: 'https://tokenwatch.ai/en/investment-results',
          },
        ],
      ];

      const thirdMessageButtons = [
        [
          {
            text: '🙏 Donate 5 USDT',
            callback_data: 'donate_5',
          },
        ],
        [
          {
            text: '🙏 Donate 25 USDT',
            callback_data: 'donate_25',
          },
        ],
        [
          {
            text: '🙏 Donate 50 USDT',
            callback_data: 'donate_50',
          },
        ],
        [
          {
            text: '🙏 Donate 100 USDT',
            callback_data: 'donate_100',
          },
        ],
      ];

      telegramBot.sendMessage(
        chatId,
        `*ℹ️ About TokenWatch*
  
TokenWatch.ai bot is your own AI oracle that provides you with best predictions on token’s potential growth right in your Telegram app!

With TokenWatch.ai you can:
Get access to the most advanced AI that analyses all tokens on the market together with social media activities
Receive 2 times a day Top-30 predictions to help you with your investment decisions

We make investments smarter 🧠
and more successful to everyone! 💰`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: firstMessageButtons,
          },
        },
      );

      telegramBot.sendMessage(
        chatId,
        `Have doubts? Check the prediction performance over here 👇👇👇`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: secondMessageButtons,
          },
        },
      );

      telegramBot.sendMessage(
        chatId,
        `If you like what we do for you and you are grateful, feel free to support further development`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: thirdMessageButtons,
          },
        },
      );
    });

    telegramBot.onText(/🔥 Trading Bots/, (msg) => {
      const chatId = msg.chat.id;

      const messageButtons = [
        [{ text: 'Money Button TradeBot', url: 'https://tokenwatch.ai/en' }],
        [{ text: 'X-Bot TradeBot', url: 'https://tokenwatch.ai/en' }],
      ];

      telegramBot.sendMessage(
        chatId,
        `*🔥 Trading Bots (partners)*

Trade bots help you automate trading based on TokenWatch AI signals and your trading strategy.

*1. Money Button TradeBot*
Features: auto buy based on TokenWatch  predictions; manual sell.

*2. X-Bot TradeBot*
Features: copytrade based on a address that follows TokenWatch predictions, manual sell, take-profit & stop-loss settings.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: messageButtons,
          },
        },
      );
    });

    telegramBot.onText(/👤 My Plan/, async (msg) => {
      const chatId = msg.chat.id;
      const utcDate = new UTCDate();

      const user = await this.prisma.tradingBotUsers.findUnique({
        where: {
          telegramId: JSON.stringify(chatId),
        },
      });

      // есть ли подписка
      if (
        user &&
        user.tradingBotSubscription &&
        user.tradingBotSubscriptionExpiresAt > utcDate
      ) {
        const subscriptionStatusMessage = `*👤 My Plan*
  
  Status: Active
  Paid till: ${user.tradingBotSubscriptionExpiresAt}`;

        telegramBot.sendMessage(chatId, subscriptionStatusMessage, {
          parse_mode: 'Markdown',
        });
      } else {
        const subscriptionStatusMessage = `*👤 My Plan*
  
  Status: Not active`;

        const pricingMessage = `To start receiving signals from TokenWatch AI buy the plan for any period you like:
  1 week - 5 USDT
  1 month - 12 USDT (40% discount)
  1 year - 69 USDT (72% discount)`;

        const priceButtons = [
          [
            {
              text: 'Buy 1 week for 5 USDT',
              callback_data: 'select_payment_method_1_week',
            },
          ],
          [
            {
              text: 'Buy 1 month for 12 USDT',
              callback_data: 'select_payment_method_1_month',
            },
          ],
          [
            {
              text: 'Buy 1 year for 69 USDT',
              callback_data: 'select_payment_method_1_year',
            },
          ],
        ];

        await telegramBot.sendMessage(chatId, subscriptionStatusMessage, {
          parse_mode: 'Markdown',
        });

        await telegramBot.sendMessage(chatId, pricingMessage, {
          reply_markup: {
            inline_keyboard: priceButtons,
          },
        });
      }
    });

    telegramBot.onText(/🚀 Get Top-30 Tokens/, async (msg) => {
      const chatId = msg.chat.id;
      const utcDate = new UTCDate();

      const user = await this.prisma.tradingBotUsers.findUnique({
        where: {
          telegramId: JSON.stringify(chatId),
        },
      });

      // есть ли подписка
      if (
        user &&
        user.tradingBotSubscription &&
        user.tradingBotSubscriptionExpiresAt > utcDate
      ) {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        if (ttms.createdAt) {
          const utcDate = new UTCDate();
          const pstDate = subHours(ttms.createdAt, 7);

          const formattedDate = format(pstDate, 'MMMM d, yyyy');
          const hours = pstDate.getUTCHours();
          const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
          const amPm = hours >= 12 ? 'pm' : 'am';

          // Сборка строки с временем
          const formattedTime = `${formattedHours}${amPm}`;

          // Собираем финальную строку
          const ttmsSolvedAt = `${formattedDate} at ${formattedTime} (PST)`;

          const minutesDifference = differenceInMinutes(
            utcDate,
            ttms.createdAt,
          );

          const message = `🚀 Get Top-30 Tokens
  
  Current Top-30 predictions is made on ${ttmsSolvedAt}
  (${minutesDifference} minutes ago)
  
  Choose blockchain to get Top-30 AI predictions 👇👇👇`;

          const buttons = [
            [
              {
                text: 'Overall Top-30',
                callback_data: 'overallTtms',
              },
            ],
            [
              {
                text: 'ETH Top-30',
                callback_data: 'ethTtms',
              },
            ],
            [
              {
                text: 'BSC Top-30',
                callback_data: 'bscTtms',
              },
            ],
            [
              {
                text: 'BASE Top-30',
                callback_data: 'baseTtms',
              },
            ],
            [
              {
                text: 'OP Top-30',
                callback_data: 'opTtms',
              },
            ],
            [
              {
                text: 'SOL Top-30',
                callback_data: 'solTtms',
              },
            ],
          ];

          await telegramBot.sendMessage(chatId, message, {
            reply_markup: {
              inline_keyboard: buttons,
            },
          });
        }
      } //
      else {
        const utcDate = new UTCDate();
        const todayStartOfDay = startOfDay(utcDate);
        const oneWeekAgo = subDays(todayStartOfDay, 7);

        let investmentsResults =
          await this.prisma.averageTtmsPortfolioResults.findMany({
            orderBy: {
              createdAt: 'desc',
            },
            where: {
              createdAt: { gte: oneWeekAgo },
            },
          });

        // let amOrPm = '9am';
        // if (investmentsResults && investmentsResults[0].startedAt === '9pm') {
        //   amOrPm = '9pm';
        // }

        // investmentsResults = investmentsResults.filter(
        //   (item) => item.startedAt === amOrPm,
        // );

        // const lastSevenResults = investmentsResults.slice(0, 7);
        const sumOfLastSeven = investmentsResults.reduce(
          (total, item) => total + parseFloat(item.average24Result),
          0,
        );

        const percentageMark = sumOfLastSeven >= 0 ? '+' : '-';

        const message = `*🚀 Get Top-30 Tokens*

Last 7d investment result is ${percentageMark}${sumOfLastSeven.toFixed(2)}%.

To start receiving AI predictions you need to buy a plan.`;

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Buy a plan', callback_data: 'buyPlan' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }
    });

    telegramBot.on('callback_query', async (query) => {
      const { data } = query;
      const chatId = query.message.chat.id;

      if (data === 'telegramButton') {
        const message = `Join TokenWatch AI community here:`;

        const buttons = [
          [
            {
              text: '📣 Official Channel',
              url: 'https://t.me/TokenWatch_ai',
            },
          ],
          [
            {
              text: '💬 English Chat',
              url: 'https://t.me/TokenWatch_ai_chat',
            },
          ],
          [
            {
              text: '💬 Chinese Chat',
              url: 'https://t.me/TokenWatch_ai_chat_ZH',
            },
          ],
          [
            {
              text: '💬 Portuguese Chat',
              url: 'https://t.me/TokenWatch_ai_chat_PT',
            },
          ],
          [
            {
              text: '💬 Spanish Chat',
              url: 'https://t.me/TokenWatch_ai_chat_ES',
            },
          ],
          [
            {
              text: '💬 Arabic Chat',
              url: 'https://t.me/TokenWatch_ai_chat_AR',
            },
          ],
          [
            {
              text: '💬 Russian Chat',
              url: 'https://t.me/TokenWatch_ai_chat_RU',
            },
          ],
        ];

        telegramBot.sendMessage(chatId, message, {
          reply_markup: {
            inline_keyboard: buttons,
          },
        });
      }

      if (data === 'supportButton') {
        const supportMessage = `In a case of any issues feel free to reach our Support Team at @tokenwatch_support

Please be patient and expect the answer during 72 hours.`;

        telegramBot.sendMessage(chatId, supportMessage);
      }

      if (data === 'overallTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 Overall Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'ethTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 1)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 ETH Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'bscTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 56)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 BSC Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'baseTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 8453)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 BASE Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'opTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 10)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 OP Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'solTtms') {
        const ttms = await this.prisma.ttmsByHours.findFirst({
          where: {
            OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
          },
          orderBy: { createdAt: 'desc' },
        });

        let score;

        if (ttms.score9am) {
          score = ttms.score9am;
        } else if (ttms.score9pm) {
          score = ttms.score9pm;
        }

        const allTtms = Object.entries(score)
          .map(([key, value]: [string, any]) => {
            return {
              tokenAddress: value.address,
              pairAddress: value.pairAddress,
              score: value.absoluteScore,
              symbol: value.symbol,
              networkId: value.networkId,
              tradeUrl: value.tradeUrl,
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 1399811149)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. [${item.symbol}](${item.tradeUrl})`,
        ); // добавляю ссылку в символ токена

        const message = `*🚀 SOL Top-30*\n\n${ttmsTop30.join('\n')}`; // соединяю все в одно сообщение

        const options = {
          parse_mode: 'Markdown' as const,
          reply_markup: {
            inline_keyboard: [
              [{ text: '← Go back', callback_data: 'goBackButton' }],
            ],
          },
        };

        telegramBot.sendMessage(chatId, message, options);
      }

      if (data === 'goBackButton' || data === 'top30') {
        const utcDate = new UTCDate();

        const user = await this.prisma.tradingBotUsers.findUnique({
          where: {
            telegramId: JSON.stringify(chatId),
          },
        });

        // есть ли подписка
        if (
          user &&
          user.tradingBotSubscription &&
          user.tradingBotSubscriptionExpiresAt > utcDate
        ) {
          const ttms = await this.prisma.ttmsByHours.findFirst({
            where: {
              OR: [{ score9am: { not: null } }, { score9pm: { not: null } }],
            },
            orderBy: { createdAt: 'desc' },
          });

          if (ttms.createdAt) {
            const utcDate = new UTCDate();
            const pstDate = subHours(ttms.createdAt, 7);

            const formattedDate = format(pstDate, 'MMMM d, yyyy');
            const hours = pstDate.getUTCHours();
            const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
            const amPm = hours >= 12 ? 'pm' : 'am';

            // Сборка строки с временем
            const formattedTime = `${formattedHours}${amPm}`;

            // Собираю финальную строку
            const ttmsSolvedAt = `${formattedDate} at ${formattedTime} (PST)`;

            const minutesDifference = differenceInMinutes(
              utcDate,
              ttms.createdAt,
            );

            const message = `🚀 Get Top-30 Tokens
    
    Current Top-30 predictions is made on ${ttmsSolvedAt}
    (${minutesDifference} minutes ago)
    
    Choose blockchain to get Top-30 AI predictions 👇👇👇`;

            const buttons = [
              [
                {
                  text: 'Overall Top-30',
                  callback_data: 'overallTtms',
                },
              ],
              [
                {
                  text: 'ETH Top-30',
                  callback_data: 'ethTtms',
                },
              ],
              [
                {
                  text: 'BSC Top-30',
                  callback_data: 'bscTtms',
                },
              ],
              [
                {
                  text: 'BASE Top-30',
                  callback_data: 'baseTtms',
                },
              ],
              [
                {
                  text: 'OP Top-30',
                  callback_data: 'opTtms',
                },
              ],
              [
                {
                  text: 'SOL Top-30',
                  callback_data: 'solTtms',
                },
              ],
            ];

            await telegramBot.sendMessage(chatId, message, {
              reply_markup: {
                inline_keyboard: buttons,
              },
            });
          }
        } //
        else {
          const utcDate = new UTCDate();
          const todayStartOfDay = startOfDay(utcDate);
          const oneWeekAgo = subDays(todayStartOfDay, 7);

          let investmentsResults =
            await this.prisma.averageTtmsPortfolioResults.findMany({
              orderBy: {
                createdAt: 'desc',
              },
              where: {
                createdAt: { gte: oneWeekAgo },
              },
            });

          // let amOrPm = '9am';
          // if (investmentsResults && investmentsResults[0].startedAt === '9pm') {
          //   amOrPm = '9pm';
          // }

          // investmentsResults = investmentsResults.filter(
          //   (item) => item.startedAt === amOrPm,
          // );

          // const lastSevenResults = investmentsResults.slice(0, 7);
          const sumOfLastSeven = investmentsResults.reduce(
            (total, item) => total + parseFloat(item.average24Result),
            0,
          );

          const percentageMark = sumOfLastSeven >= 0 ? '+' : '-';

          const message = `*🚀 Get Top-30 Tokens*
  
  Last 7d investment result is ${percentageMark}${sumOfLastSeven.toFixed(2)}%.
  
  To start receiving AI predictions you need to buy a plan.`;

          const options = {
            parse_mode: 'Markdown' as const,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Buy a plan', callback_data: 'buyPlan' }],
              ],
            },
          };

          telegramBot.sendMessage(chatId, message, options);
        }
      }

      if (data === 'buyPlan') {
        const utcDate = new UTCDate();

        const user = await this.prisma.tradingBotUsers.findUnique({
          where: {
            telegramId: JSON.stringify(chatId),
          },
        });

        // есть ли подписка
        if (
          user &&
          user.tradingBotSubscription &&
          user.tradingBotSubscriptionExpiresAt > utcDate
        ) {
          const subscriptionStatusMessage = `*👤 My Plan*
    
    Status: Active
    Paid till: ${user.tradingBotSubscriptionExpiresAt}`;

          telegramBot.sendMessage(chatId, subscriptionStatusMessage, {
            parse_mode: 'Markdown',
          });
        } else {
          const subscriptionStatusMessage = `*👤 My Plan*
    
    Status: Not active`;

          const pricingMessage = `To start receiving signals from TokenWatch AI buy the plan for any period you like:
    1 week - 5 USDT
    1 month - 12 USDT (40% discount)
    1 year - 69 USDT (72% discount)`;

          const priceButtons = [
            [
              {
                text: 'Buy 1 week for 5 USDT',
                callback_data: 'select_payment_method_1_week',
              },
            ],
            [
              {
                text: 'Buy 1 month for 12 USDT',
                callback_data: 'select_payment_method_1_month',
              },
            ],
            [
              {
                text: 'Buy 1 year for 69 USDT',
                callback_data: 'select_payment_method_1_year',
              },
            ],
          ];

          await telegramBot.sendMessage(chatId, subscriptionStatusMessage, {
            parse_mode: 'Markdown',
          });

          await telegramBot.sendMessage(chatId, pricingMessage, {
            reply_markup: {
              inline_keyboard: priceButtons,
            },
          });
        }
      }

      if (data.startsWith('select_payment_method')) {
        const period = data.split('_').slice(-2).join('_');

        const paymentMethods = [
          [
            {
              text: 'Telegram Stars',
              callback_data: `pay_${period}_telegram_stars`,
            },
          ],
          [
            {
              text: 'Cryptomus',
              callback_data: `pay_${period}_cryptomus`,
            },
          ],
        ];

        await telegramBot.sendMessage(chatId, 'Choose a payment method:', {
          reply_markup: {
            inline_keyboard: paymentMethods,
          },
        });
      }

      if (data.startsWith('pay_')) {
        const match = data.match(
          /^pay_(\d+_week|\d+_month|\d+_year)_(telegram_stars|cryptomus)$/,
        );
        if (!match) {
          console.error('Invalid payment data:', data);
          return;
        }
        const period = match[1];
        const paymentMethod = match[2];

        let title, description, payload, prices;
        if (period === '1_week') {
          title = '1 Week';
          description = '1 week subscription to TokenWatch AI';
          payload = '1_week_subscription';
          prices = [{ label: '1 Week Subscription', amount: 250 }];
        } else if (period === '1_month') {
          title = '1 Month';
          description = '1 month subscription to TokenWatch AI';
          payload = '1_month_subscription';
          prices = [{ label: '1 Month Subscription', amount: 600 }];
        } else if (period === '1_year') {
          title = '1 Year';
          description = '1 year subscription to TokenWatch AI';
          payload = '1_year_subscription';
          prices = [{ label: '1 Year Subscription', amount: 3450 }];
        }

        if (paymentMethod === 'telegram_stars') {
          await telegramBot.sendInvoice(
            chatId,
            title,
            description,
            payload,
            '',
            'XTR',
            prices,
          );
        } else if (paymentMethod === 'cryptomus') {
          if (period === '1_week') {
            prices = [{ label: '1 Week Subscription', amount: 5 }];
          }
          if (period === '1_month') {
            prices = [{ label: '1 Month Subscription', amount: 12 }];
          }
          if (period === '1_year') {
            prices = [{ label: '1 Year Subscription', amount: 69 }];
          }
          await processCryptomusPayment(
            this.prisma,
            chatId,
            title,
            description,
            prices,
          );
        }
      }

      // if (data === 'pay_1_week') {
      //   const title = '1 Week Subscription';
      //   const description = '1 week subscription to TokenWatch AI';
      //   const payload = '1_week_subscription';
      //   const prices = [{ label: '1 Week Subscription', amount: 250 }];

      //   // симулирую процесс оплаты
      //   // const fakeMessage = {
      //   //   chat: { id: 1161414429 },
      //   //   successful_payment: { invoice_payload: '1_week_subscription' },
      //   // };

      //   // await simulateSuccessfulPayment(fakeMessage);

      //   await telegramBot.sendInvoice(
      //     chatId,
      //     title,
      //     description,
      //     payload,
      //     '',
      //     'XTR',
      //     prices,
      //   );
      // }

      // if (data === 'pay_1_month') {
      //   const title = '1 Month Subscription';
      //   const description = '1 month subscription to TokenWatch AI';
      //   const payload = '1_month_subscription';
      //   const prices = [{ label: '1 Month Subscription', amount: 600 }];

      //   await telegramBot.sendInvoice(
      //     chatId,
      //     title,
      //     description,
      //     payload,
      //     '',
      //     'XTR',
      //     prices,
      //   );
      // }

      // if (data === 'pay_1_year') {
      //   const title = '1 Year Subscription';
      //   const description = '1 year subscription to TokenWatch AI';
      //   const payload = '1_year_subscription';
      //   const prices = [{ label: '1 Year Subscription', amount: 3450 }];

      //   await telegramBot.sendInvoice(
      //     chatId,
      //     title,
      //     description,
      //     payload,
      //     '',
      //     'XTR',
      //     prices,
      //   );
      // }
    });

    async function processCryptomusPayment(
      prisma,
      chatId,
      title,
      description,
      prices,
    ) {
      const cryptomusApiUrl = 'https://api.cryptomus.com/v1/payment';
      const merchant = process.env.CRYPTOMUS_MERCHANT;
      const apiKey = process.env.CRYPTOMUS_API_KEY;

      // const amount = 0.1;
      const amount = prices[0].amount;
      const orderId = `${chatId}_${title.replace(/\s+/g, '_')}_${Date.now()}`;
      const callbackUrl =
        'https://ca72-185-222-239-176.ngrok-free.app/api/cryptomus-webhook';

      const requestData = {
        amount: amount.toString(),
        currency: 'USD',
        order_id: orderId,
        url_callback: callbackUrl,
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

        const paymentUrl = response.data.result.url;
        const paymentData = response.data.result;
        const uuid = paymentData.uuid;

        const message = 'Please complete your payment using the button below:';
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: 'Pay Now',
                  url: paymentUrl,
                },
              ],
            ],
          },
        };

        await prisma.cryptomusTransactions.create({
          data: {
            uuid: uuid,
            orderId: paymentData.order_id,
            amount: paymentData.amount,
            currency: paymentData.currency,
            url: paymentData.url,
            isFinal: paymentData.isFinal,
            userTelegramId: JSON.stringify(chatId),
          },
        });

        await telegramBot.sendMessage(chatId, message, options);
      } catch (error) {
        console.error('Error processing Cryptomus payment:', error);
        await telegramBot.sendMessage(
          chatId,
          'There was an error processing your payment. Please try again later.',
        );
      }
    }

    telegramBot.on('pre_checkout_query', async (query) => {
      const preCheckoutQueryId = query.id;
      await telegramBot.answerPreCheckoutQuery(preCheckoutQueryId, true);
    });

    telegramBot.on('message', async (msg) => {
      if (msg.successful_payment) {
        const chatId = msg.chat.id;
        const payload = msg.successful_payment.invoice_payload;

        const utcNow = new Date();

        let newExpiryDate;
        if (payload === '1_week_subscription') {
          newExpiryDate = addDays(utcNow, 7);
        } else if (payload === '1_month_subscription') {
          newExpiryDate = addMonths(utcNow, 1);
        } else if (payload === '1_year_subscription') {
          newExpiryDate = addYears(utcNow, 1);
        }

        let user = await prisma.tradingBotUsers.findUnique({
          where: { telegramId: JSON.stringify(chatId) },
        });

        if (user) {
          // Если подписка пользователя еще активна, добавляю время к текущей дате окончания подписки
          if (
            user.tradingBotSubscriptionExpiresAt &&
            user.tradingBotSubscriptionExpiresAt > utcNow
          ) {
            const currentExpiryDate = new Date(
              user.tradingBotSubscriptionExpiresAt,
            );
            if (payload === '1_week_subscription') {
              newExpiryDate = addDays(currentExpiryDate, 7);
            } else if (payload === '1_month_subscription') {
              newExpiryDate = addMonths(currentExpiryDate, 1);
            } else if (payload === '1_year_subscription') {
              newExpiryDate = addYears(currentExpiryDate, 1);
            }
          }
          user = await prisma.tradingBotUsers.update({
            where: { telegramId: JSON.stringify(chatId) },
            data: {
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
          });
        } else {
          user = await prisma.tradingBotUsers.upsert({
            where: { telegramId: JSON.stringify(chatId) },
            update: {
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
            create: {
              telegramId: JSON.stringify(chatId),
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
          });
        }

        const formattedExpiryDate = format(newExpiryDate, 'MMMM d, yyyy');
        const messageText = `*Purchase complete*

Your plan has been activated till ${formattedExpiryDate}.

Go get the latest signals.`;

        await telegramBot.sendMessage(chatId, messageText, {
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
      }
    });

    // Функция для симуляции успешной оплаты
    async function simulateSuccessfulPayment(msg) {
      if (msg.successful_payment) {
        const chatId = msg.chat.id;
        const payload = msg.successful_payment.invoice_payload;

        const utcNow = new Date();

        let newExpiryDate;
        if (payload === '1_week_subscription') {
          newExpiryDate = addDays(utcNow, 7);
        } else if (payload === '1_month_subscription') {
          newExpiryDate = addMonths(utcNow, 1);
        } else if (payload === '1_year_subscription') {
          newExpiryDate = addYears(utcNow, 1);
        }

        let user = await prisma.tradingBotUsers.findUnique({
          where: { telegramId: JSON.stringify(chatId) },
        });

        if (user) {
          // Если подписка пользователя еще активна, добавляю время к текущей дате окончания подписки
          if (
            user.tradingBotSubscriptionExpiresAt &&
            user.tradingBotSubscriptionExpiresAt > utcNow
          ) {
            const currentExpiryDate = new Date(
              user.tradingBotSubscriptionExpiresAt,
            );
            if (payload === '1_week_subscription') {
              newExpiryDate = addDays(currentExpiryDate, 7);
            } else if (payload === '1_month_subscription') {
              newExpiryDate = addMonths(currentExpiryDate, 1);
            } else if (payload === '1_year_subscription') {
              newExpiryDate = addYears(currentExpiryDate, 1);
            }
          }
          user = await prisma.tradingBotUsers.update({
            where: { telegramId: JSON.stringify(chatId) },
            data: {
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
          });
        } else {
          user = await prisma.tradingBotUsers.upsert({
            where: { telegramId: JSON.stringify(chatId) },
            update: {
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
            create: {
              telegramId: JSON.stringify(chatId),
              tradingBotSubscription: true,
              tradingBotSubscriptionExpiresAt: newExpiryDate,
            },
          });
        }

        const formattedExpiryDate = format(newExpiryDate, 'MMMM d, yyyy');
        const messageText = `*Purchase complete*

Your plan has been activated till ${formattedExpiryDate}.

Go get the latest signals.`;

        await telegramBot.sendMessage(chatId, messageText, {
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
      }
    }
  }
  public static getBotInstance(): TelegramBot {
    if (!this.bot) {
      throw new Error('Bot is not initialized.');
    }
    return this.bot;
  }
}
