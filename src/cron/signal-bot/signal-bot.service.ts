import { UTCDate } from '@date-fns/utc';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { subDays, subHours } from 'date-fns';
import * as TelegramBot from 'node-telegram-bot-api';
import * as initData from '@tma.js/init-data-node';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class SignalBotService {
  private static bot: TelegramBot;
  private authorizedUsers: Set<number>; // множество для хранения id авторизованных пользователей

  constructor(
    private readonly prisma: PrismaClient,
    private readonly authService: AuthService,
  ) {
    if (!SignalBotService.bot) {
      SignalBotService.bot = new TelegramBot(process.env.TG_SIGNAL_BOT_TOKEN, {
        polling: true,
      });
    }
    const telegramBot = SignalBotService.bot;
    this.authorizedUsers = new Set();
    let userId = 0;

    telegramBot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const refId = msg.text.split(' ')[1]?.split('-')[1];

      const webAppUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      const refAppUrl = new URL(
        `${process.env.SIGNAL_BOT_WEBAPP_URL}/referral-program`,
      );

      webAppUrl.searchParams.append('telegramId', userId.toString());
      refAppUrl.searchParams.append('telegramId', userId.toString());

      if (refId) {
        webAppUrl.searchParams.append('ref', refId);
        refAppUrl.searchParams.append('ref', refId);
      }

      console.log('webAppUrl', webAppUrl.href);
      console.log('refAppUrl', refAppUrl.href);

      const buttons = [
        [
          {
            text: '🚀 Top-30 ToTheMoonScore',
            web_app: {
              url: webAppUrl.href,
            },
          },
        ],
        [
          {
            text: '💰 Referral',
            web_app: {
              url: refAppUrl.href,
            },
          },
          {
            text: '💎 AirDrops',
            web_app: {
              url: 'https://twa.tokenwatch.ai/airdrops',
            },
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

      const welcomeMessage = `Hi there! 👋

Welcome to the TokenWatch AI bot.
  
Tap one of the buttons below:
  
🚀 Top-30 ToTheMoonScore - receive up to 4 times a day ToTheMoonScore AI predictions
  
💰 Referral - earn $TOKENWATCH tokens for inviting friends

ℹ️ About - more info about this bot and links
  
We are here to help your daily tokens investment decisions become smarter 🧠

To get your first Top-30 tokens predictions click on “🚀 Top-30 ToTheMoonScore”.`;

      telegramBot.sendMessage(chatId, welcomeMessage, options);
    });

    telegramBot.onText(/ℹ️ About/, (msg) => {
      const chatId = msg.chat.id;
      telegramBot.sendMessage(
        chatId,
        `About TokenWatch

TokenWatch.ai bot is your own AI oracle that provides you with best predictions on token’s potential growth right in your Telegram app!

With TokenWatch.ai you can:
• Get access to the most advanced AI that analyses all tokens on the market together with social media activities for you
• Receive up to 4 times a day Top-30 predictions to help you with your investment decisions
• Earn $TOKENWATCH tokens for inviting friends

We make investments smarter 🧠
and more successful to everyone! 💰`,
      );

      const buttons = [
        [
          {
            text: 'Buy $TOKENWATCH on DEX',
            url: 'https://app.uniswap.org/swap?outputCurrency=0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3',
          },
        ],
        [
          {
            text: 'Buy $TOKENWATCH on CEX',
            url: 'https://www.bitrue.com/trade/tokenwatch_usdt',
          },
        ],
        [{ text: '🌐 Website', url: 'https://tokenwatch.ai/en' }],
        [{ text: '🐦 Twitter', url: 'https://twitter.com/TokenWatch_ai' }],
        [
          {
            text: '📣 Telegram',
            url: 'https://t.me/TokenWatch_ai',
          },
        ],
        [{ text: '❓ Support', callback_data: 'button6' }],
      ];

      telegramBot.sendMessage(
        chatId,
        `ToTheMoonScore

ToTheMoonScore™ is the summarised result of deep Artificial Intelligence analyses of every token.

It is the score from 1 to 100 that shows the current growth potential.

Start getting your first Top-30 tokens predictions now by clicking  on “🚀 Top-30 ToTheMoonScore“.`,
        {
          reply_markup: {
            inline_keyboard: buttons,
          },
        },
      );
    });

    telegramBot.on('callback_query', (query) => {
      const { data } = query;
      const chatId = query.message.chat.id;

      if (data === 'button6') {
        const supportMessage = `In a case of any issues feel free to reach our Support Team at support@tokenwatch.ai\n\nPlease be patient and expect the answer in 72 hours.`;

        telegramBot.sendMessage(chatId, supportMessage);
      }
    });

    telegramBot.onText(/\/checkSubscriptionToChannel/, async (msg) => {
      const chatId = msg.chat.id;
      userId = msg.from.id;

      const isSubscribedToTheTelegramChannel =
        await this.checkSubscriptionByUserId('-1001844688490', userId);
      console.log(isSubscribedToTheTelegramChannel);
    });
  }

  async checkSubscriptionByUserId(
    channelId: string,
    userId: number,
  ): Promise<boolean> {
    try {
      if (!SignalBotService.bot) {
        SignalBotService.bot = new TelegramBot(
          process.env.TG_SIGNAL_BOT_TOKEN,
          {
            polling: true,
          },
        );
      }
      const telegramBot = SignalBotService.bot;

      const chat = await telegramBot.getChatMember(channelId, userId);
      return (
        chat.status === 'member' ||
        chat.status === 'creator' ||
        chat.status === 'administrator'
      );
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async checkUserHasVoted(walletAddress: string) {
    const utcDate = new UTCDate();
    const date24hoursAgo = subHours(utcDate, 24);

    const userVotes = await this.prisma.votes.findMany({
      where: {
        AND: [
          { date: { gte: date24hoursAgo } },
          { walletAddress: walletAddress },
        ],
      },
    });

    if (userVotes.length >= 5) {
      return true;
    }
    return false;
  }

  async sendMessageToAllUsers(): Promise<number> {
    try {
      if (!SignalBotService.bot) {
        SignalBotService.bot = new TelegramBot(
          process.env.TG_SIGNAL_BOT_TOKEN,
          {
            polling: true,
          },
        );
      }
      const telegramBot = SignalBotService.bot;

      const utcDate = new UTCDate();
      const sevenDaysAgo = subDays(utcDate, 7);
      const pstDate = subHours(utcDate, 8);
      const currentPstHour = pstDate.getUTCHours();

      let allSubscriptions = null;

      if (currentPstHour === 3 || currentPstHour === 15) {
        allSubscriptions = await this.prisma.subscriptions.findFirst({
          where: {
            title: 'plan2',
          },
        });
      } else {
        allSubscriptions = await this.prisma.subscriptions.findMany();
      }

      const allUsers = await this.prisma.users.findMany({
        where: {
          telegramId: { gt: 0 },
        },
      });

      let sendedMessagesCount = 0;

      const webAppUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      const message = `🌟 ToTheMoonScore Top-30 Portfolio Update! 🌟

The Top-30 list of tokens has just been updated and available in the Bot.
      
Check it by clicking the button below 👇`;

      const photoPath =
        'https://twa.tokenwatch.ai/tokenwatch_signalbot_autopost.png';

      for (const user of allUsers) {
        const chatId = user.telegramId;

        const subscription = allSubscriptions.find(
          (subscription) => subscription.title === user.subscriptionLevel,
        );

        // проверяю активность подписок plan1 или plan2
        if (
          subscription &&
          (subscription.title === 'plan1' || subscription.title === 'plan2') &&
          parseFloat(user.holdingTWAmountUSDT) >= subscription.holdingTWAmount
        ) {
          await telegramBot.sendPhoto(chatId, photoPath, {
            caption: message,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Get your free Top-30 list',
                    web_app: {
                      url: webAppUrl.href,
                    },
                  },
                ],
              ],
            },
          });
          sendedMessagesCount++;
        }

        // проверяю активность триала
        if (
          subscription &&
          subscription.title === 'trial' &&
          user.trialCreatedAt > sevenDaysAgo
        ) {
          await telegramBot.sendPhoto(chatId, photoPath, {
            caption: message,
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: 'Get your free Top-30 list',
                    web_app: {
                      url: webAppUrl.href,
                    },
                  },
                ],
              ],
            },
          });
          sendedMessagesCount++;
        }

        // проверяю активность реферальной подписки
        if (subscription && subscription.title === 'plan3') {
          const subscribedReferralsCount =
            await this.authService.checkReferrals(user.walletAddress);

          if (subscribedReferralsCount >= 3) {
            await telegramBot.sendPhoto(chatId, photoPath, {
              caption: message,
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: 'Get your free Top-30 list',
                      web_app: {
                        url: webAppUrl.href,
                      },
                    },
                  ],
                ],
              },
            });
            sendedMessagesCount++;
          }
        }
      }
      return sendedMessagesCount;
    } catch (error) {
      return error;
    }
  }
}
