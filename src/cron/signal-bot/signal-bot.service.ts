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
    let startRefId = undefined;

    telegramBot.onText(/\/start/, async (msg) => {
      console.log('start');

      const chatId = msg.chat.id;

      const userId = msg.from.id;

      const user = await telegramBot.getChat(userId);

      const userName = user.username;

      startRefId = msg.text.split(' ')[1]?.split('-')[1];

      console.log('startRefId', startRefId);

      await this.prisma.signalBotUsers.upsert({
        where: { telegramId: JSON.stringify(chatId) },
        create: {
          telegramId: JSON.stringify(chatId),
        },
        update: {
          userName,
        },
      });

      const buttons = [
        [
          {
            text: '🚀 Top-30 ToTheMoonScore',
            callback_data: 'top30',
          },
        ],
        [
          {
            text: '💰 Referral',
            callback_data: 'referral',
          },
          {
            text: '💎 AirDrops',
            callback_data: 'airdrops',
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

      const betaMessage = `⚡️⚡️⚡️ INFORMATION ⚡️⚡️⚡️

Signal Bot is in beta now and works accurately only on PC / Mac.

Android and iOS version is to be released next days.

If you find any accidential errors and can't proceed please write to support@tokenwatch.ai`;

      telegramBot.sendMessage(chatId, welcomeMessage, options);

      setTimeout(
        () => telegramBot.sendMessage(chatId, betaMessage, options),
        1000,
      );
    });

    telegramBot.onText(/\/block/, async (msg) => {
      console.log('blocked');
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
        [{ text: '❓ Support', callback_data: 'button6' }],
      ];

      const secondMessageButtons = [
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
      ];

      telegramBot.sendMessage(
        chatId,
        `*About TokenWatch*

TokenWatch.ai bot is your own AI oracle that provides you with best predictions on token’s potential growth right in your Telegram app!

With TokenWatch.ai you can:
• Get access to the most advanced AI that analyses all tokens on the market together with social media activities for you
• Receive up to 4 times a day Top-30 predictions to help you with your investment decisions
• Earn $TOKENWATCH tokens for inviting friends

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
        `*ToTheMoonScore*

ToTheMoonScore™ is the summarised result of deep Artificial Intelligence analyses of every token.
        
It is the score from 1 to 100 that shows the current growth potential.
        
Start getting your first Top-30 tokens predictions now by clicking  on “🚀 *Top-30 ToTheMoonScore*“.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: secondMessageButtons,
          },
        },
      );
    });

    telegramBot.onText(/🚀 Top-30 ToTheMoonScore/, (msg) => {
      const chatId = msg.chat.id;

      const mainPageUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      if (startRefId) {
        mainPageUrl.searchParams.append('ref', startRefId);
      }

      const top30Button = [
        [{ text: 'Get Your Top-30', url: mainPageUrl.href }],
      ];

      const top30ReplyMarkup = {
        inline_keyboard: top30Button,
      };

      const top30Options = {
        reply_markup: top30ReplyMarkup,
        disable_notification: true,
      };

      telegramBot.sendMessage(
        chatId,
        'To get ToTheMoonScore Top-30 tokens predicted by TokenWatch AI click the button below 👇👇👇',
        top30Options,
      );
    });

    telegramBot.onText(/💰 Referral/, (msg) => {
      const chatId = msg.chat.id;

      const mainPageUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      const referralPageUrl = new URL(`/referral-program`, mainPageUrl);

      if (startRefId) {
        referralPageUrl.searchParams.append('ref', startRefId);
      }

      const referralButton = [
        [{ text: 'Go to Referral Page', url: referralPageUrl.href }],
      ];

      const referralReplyMarkup = {
        inline_keyboard: referralButton,
      };

      const referralOptions = {
        reply_markup: referralReplyMarkup,
        disable_notification: true,
      };

      telegramBot.sendMessage(
        chatId,
        `*Referral Program*

Are you an influencer? Have a lot of friends? Do you own a community?

Benefit from it!!`,
        {
          parse_mode: 'Markdown',
          reply_markup: referralReplyMarkup,
          disable_notification: true,
        },
      );
    });

    telegramBot.onText(/💎 AirDrops/, async (msg) => {
      const chatId = msg.chat.id;

      const mainPageUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      const airdrop1Url = new URL(`/airdrops`, mainPageUrl);

      const airdrop2Url = new URL(`/airdrops`, mainPageUrl);

      if (startRefId) {
        airdrop1Url.searchParams.append('ref', startRefId);
        airdrop2Url.searchParams.append('ref', startRefId);
      }

      const airdrop1Button = [
        [
          {
            text: 'Learn more >>',
            url: airdrop1Url.href,
          },
        ],
      ];

      const airdrop2Button = [
        [
          {
            text: 'Learn more >>',
            url: airdrop2Url.href,
          },
        ],
      ];

      const airdrop1ReplyMarkup = {
        inline_keyboard: airdrop1Button,
      };

      const airdrop2ReplyMarkup = {
        inline_keyboard: airdrop2Button,
      };

      const airdrop1Options = {
        reply_markup: airdrop1ReplyMarkup,
        disable_notification: true,
      };

      const airdrop2Options = {
        reply_markup: airdrop2ReplyMarkup,
        disable_notification: true,
      };

      await telegramBot.sendMessage(
        chatId,
        `*AirDrops*

We reward you with $TOKENWATCH tokens by results of the following Airdrop campaigns:`,
        {
          parse_mode: 'Markdown',
        },
        // airdropsOptions,
      );

      const airdrop1PhotoPath =
        'https://twa.tokenwatch.ai/airdrop1_mainpic.png?2';
      const airdrop2PhotoPath =
        'https://twa.tokenwatch.ai/airdrop2_mainpic.png';

      const airdrop1Message = `*[AirDrop 1] Get $5 by starting free Signal Bot TRIAL*

Reward pool of $500\\* will be distributed among first 100 users who will start free TokenWatch Signal Bot TRIAL.

The campaign is First Come First Served.

\\* in $TOKENWATCH tokens on market price at distribution moment`;

      const airdrop2Message = `*[AirDrop 2] Get $100 by using PLAN 1 for 30 days*

Reward pool of $10,000\\* will be distributed among first 100 users. Users need to use TokenWatch Signal Bot PLAN 1 for at least 30 days to be eligible.

Kindly monitor your $TOKENWATCH tokens balance (to maintain PLAN 1 for 30 days) to ensure access is not interrupted due to market price fluctuations. Maintain PLAN 1 for 30 days by keeping more than 2,000 USDT worth of $TOKENWATCH tokens at any moment.

The campaign is First Come First Serve.

\\* in $TOKENWATCH tokens on market price at distribution moment`;

      await telegramBot.sendPhoto(chatId, airdrop1PhotoPath, {
        caption: airdrop1Message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Learn more >>',
                url: airdrop1Url.href,
              },
            ],
          ],
        },
      });

      await telegramBot.sendPhoto(chatId, airdrop2PhotoPath, {
        caption: airdrop2Message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Learn more >>',
                url: airdrop2Url.href,
              },
            ],
          ],
        },
      });
    });

    telegramBot.on('callback_query', (query) => {
      const { data } = query;
      const chatId = query.message.chat.id;

      if (data === 'telegramButton') {
        const message = `Choose among Telegram groups:`;

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
      const pstDate = subHours(utcDate, 7);
      const currentPstHour = pstDate.getUTCHours();

      let allSubscriptions = null;

      if (currentPstHour === 3 || currentPstHour === 15) {
        allSubscriptions = await this.prisma.subscriptions.findFirst({
          where: {
            title: 'plan2',
          },
        });
      }
      if (currentPstHour === 9 || currentPstHour === 21) {
        allSubscriptions = await this.prisma.subscriptions.findMany();
      }

      const allUsers = await this.prisma.users.findMany({
        where: {
          telegramId: { not: null },
        },
      });

      let sendedMessagesCount = 0;

      const webAppUrl = new URL(process.env.SIGNAL_BOT_WEBAPP_URL);

      const message = `Hello!
      
ToTheMoonScore has been updated with fresh Top-30 ToTheMoonScore predictions for you!
      
Press “🚀 *Top-30 ToTheMoonScore*“ button to get it.`;

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
          Array.isArray(allSubscriptions) &&
          (subscription.title === 'plan1' || subscription.title === 'plan2') &&
          parseFloat(user.holdingTWAmountUSDT) >= subscription.holdingTWAmount
        ) {
          await telegramBot.sendPhoto(chatId, photoPath, {
            caption: message,
            parse_mode: 'Markdown',
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
          Array.isArray(allSubscriptions) &&
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
        if (
          subscription &&
          Array.isArray(allSubscriptions) &&
          subscription.title === 'plan3'
        ) {
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
