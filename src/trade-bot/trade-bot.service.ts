import { UTCDate } from '@date-fns/utc';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  subDays,
  subHours,
  format,
  differenceInMinutes,
  startOfDay,
} from 'date-fns';
import * as TelegramBot from 'node-telegram-bot-api';
import * as initData from '@tma.js/init-data-node';
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
              url: `https://t.me/${botUsername}?start=pay_1_week`,
            },
          ],
          [
            {
              text: 'Buy 1 month for 12 USDT',
              url: `https://t.me/${botUsername}?start=pay_1_month`,
            },
          ],
          [
            {
              text: 'Buy 1 year for 69 USDT',
              url: `https://t.me/${botUsername}?start=pay_1_year`,
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

    telegramBot.onText(/\/start pay_(.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const plan = match[1];

      let prices;
      if (plan === '1_week') {
        prices = [{ label: '1 week plan', amount: 500 }];
      } else if (plan === '1_month') {
        prices = [{ label: '1 month plan', amount: 1200 }];
      } else if (plan === '1_year') {
        prices = [{ label: '1 year plan', amount: 6900 }];
      }

      telegramBot.sendInvoice(
        chatId,
        `Subscription Plan: ${plan.replace('_', ' ')}`,
        `Get access to TokenWatch AI for ${plan.replace('_', ' ')}`,
        `invoice_payload_${plan}`,
        paymentToken,
        'USDT',
        prices,
      );
    });

    telegramBot.on('pre_checkout_query', (query) => {
      telegramBot.answerPreCheckoutQuery(query.id, true);
    });

    telegramBot.on('successful_payment', async (msg) => {
      const chatId = msg.chat.id;
      const payload = msg.successful_payment.invoice_payload;
      let expiresAt;

      if (payload === 'invoice_payload_1_week') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
      } else if (payload === 'invoice_payload_1_month') {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (payload === 'invoice_payload_1_year') {
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      await prisma.tradingBotUsers.update({
        where: { telegramId: JSON.stringify(chatId) },
        data: {
          tradingBotSubscription: true,
          tradingBotSubscriptionExpiresAt: expiresAt,
        },
      });

      telegramBot.sendMessage(
        chatId,
        `Thank you for your purchase! Your subscription is now active until ${expiresAt}`,
      );
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
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 1)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 56)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 8453)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 10)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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
            };
          })
          .sort((a, b) => b.score - a.score)
          .filter((item) => item.networkId === 1399811149)
          .slice(0, 30);

        const ttmsTop30 = allTtms.map(
          (item, index) => `${index + 1}. $${item.symbol}`,
        ); // нумерую и извлекаю symbol токенов

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

      if (data === 'goBackButton') {
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
                url: 'https://tokenwatch.ai/en',
              },
            ],
            [
              {
                text: 'Buy 1 month for 12 USDT',
                url: 'https://tokenwatch.ai/en',
              },
            ],
            [
              {
                text: 'Buy 1 year for 69 USDT',
                url: 'https://tokenwatch.ai/en',
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
    });
  }
}
