import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class PrivateBotService {
  private bot: TelegramBot;
  private authorizedUsers: Set<number>; // множество для хранения id авторизованных пользователей

  constructor() {
    this.bot = new TelegramBot(process.env.AUTH_TELEGRAM_BOT_TOKEN_TEST, {
      polling: true,
    });
    this.authorizedUsers = new Set();

    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(
        chatId,
        'Привет! Отправь мне строку с правильным текстом для авторизации.',
      );
    });

    this.bot.onText(/^(.*?)$/, (msg, match) => {
      const chatId = msg.chat.id;
      const userInput = match[1]; // текст сообщения от пользователя

      if (this.authorizedUsers.has(chatId)) {
        // Пользователь уже авторизован
        this.bot.sendMessage(chatId, 'Вы уже авторизованы!');
      } else {
        // Пользователь не авторизован
        this.bot.sendMessage(
          chatId,
          'Вы не авторизованы. Отправьте /start для начала процесса авторизации.',
        );
      }
    });

    this.bot.onText(/\/logout/, (msg) => {
      const chatId = msg.chat.id;

      if (this.authorizedUsers.has(chatId)) {
        this.authorizedUsers.delete(chatId);
        this.bot.sendMessage(chatId, 'Вы успешно деавторизованы.');
      } else {
        this.bot.sendMessage(chatId, 'Вы не авторизованы.');
      }
    });
  }
}
