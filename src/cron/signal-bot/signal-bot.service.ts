import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class SignalBotService {
  private bot: TelegramBot;
  private authorizedUsers: Set<number>; // множество для хранения id авторизованных пользователей

  constructor() {
    this.bot = new TelegramBot(process.env.TG_SIGNAL_BOT_TOKEN, {
      polling: true,
    });
    this.authorizedUsers = new Set();

    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      const welcomeMessage = `Hi there! 👋

  Welcome to the TokenWatch AI bot.
  
  Tap one of the buttons below:
  
  🚀 Top-30 ToTheMoonScore - receive up to 4 times a day ToTheMoonScore AI predictions
  
  💰 Referral - earn $TOKENWATCH tokens for inviting friends
  
  ℹ️ About - more info about this bot and links
  
  We are here to help your daily tokens investment decisions become smarter 🧠
  
  To get your first Top-30 tokens predictions click on “🚀 Top-30 ToTheMoonScore”.`;

      const buttons = [
        [
          {
            text: '🚀 Top-30 ToTheMoonScore',
            web_app: {
              url: 'https://tokenwatch.ai/en',
            },
          },
        ],
        [
          { text: '💰 Referral', callback_data: 'referral' },
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

      this.bot.sendMessage(chatId, welcomeMessage, options);
    });

    this.bot.onText(/💰 Referral/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, 'Текст для Рефералов');
    });

    this.bot.onText(/ℹ️ About/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(
        chatId,
        `About TokenWatch

      TokenWatch.ai bot is your own AI oracle that provides you with best predictions on token’s potential growth right in your Telegram app!
      
      With TokenWatch.ai you can:
      Get access to the most advanced AI that analyses all tokens on the market together with social media activities for you
      Receive up to 4 times a day Top-30 predictions to help you with your investment decisions
      Earn $TOKENWATCH tokens for inviting friends
      
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
        [{ text: '🐦 Twitter', url: 'https://t.me/TokenWatch_ai' }],
        [
          {
            text: '📣 Telegram',
            url: 'https://web.telegram.org/a/#-1001880299449',
          },
        ],
        [{ text: '❓ Support', callback_data: 'button6' }],
      ];

      this.bot.sendMessage(
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

    this.bot.on('callback_query', (query) => {
      const { data } = query;
      const chatId = query.message.chat.id;

      if (data === 'button6') {
        const supportMessage = `In a case of any issues feel free to reach our Support Team at support@tokenwatch.ai\n\nPlease be patient and expect the answer in 72 hours.`;

        this.bot.sendMessage(chatId, supportMessage);
      }
    });
  }
}
