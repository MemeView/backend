import { Injectable, UnauthorizedException, Res } from '@nestjs/common';
import { Response } from 'express'; // Импортируем модуль Response
import * as jwt from 'jsonwebtoken';
import { isAddress } from 'ethers';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import Web3 from 'web3';

interface subscriber {
  walletAddress: string;
  telegramId: string;
  holdingTWAmount: number;
  holdingTWAmountUSDT: number;
  subscriptionLevel: string;
}

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(walletAddress: string): Promise<any> {
    const user = await this.prisma.users.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }

  async signUp(walletAddress: string, res: Response): Promise<any> {
    try {
      // Проверка, является ли walletAddress действительным адресом кошелька Ethereum
      const isValidAddress = isAddress(walletAddress);

      if (!isValidAddress) {
        throw new UnauthorizedException('Invalid wallet address');
      }

      const user = await this.prisma.users.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });

      const accessToken = jwt.sign(
        { walletAddress: user.walletAddress },
        process.env.JWT_SECRET,
        {
          expiresIn: '10m',
        },
      );

      const refreshToken = jwt.sign(
        { walletAddress: user.walletAddress },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d',
        },
      );

      await this.prisma.users.update({
        where: { walletAddress },
        data: {
          refreshToken,
          refreshTokenCreatedAt: new Date(),
        },
      });

      // Установка cookie с accessToken
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        maxAge: 600000, // 10 минут в миллисекундах
      });

      return {
        user,
        accessToken,
      };
    } catch (error) {
      return error;
    }
  }

  async signUpWithTelegram(
    walletAddress: string,
    telegramId: string,
    res: Response,
  ) {
    try {
      // Проверка, является ли walletAddress действительным адресом кошелька Ethereum
      const isValidAddress = isAddress(walletAddress);

      if (!isValidAddress) {
        throw new UnauthorizedException('Invalid wallet address');
      }

      const wallet = await this.prisma.users.findUnique({
        where: { walletAddress: walletAddress },
      });

      let user = null;

      if (!wallet) {
        user = await this.prisma.users.create({
          data: { walletAddress: walletAddress, telegramId: telegramId },
        });
      }

      if (
        wallet &&
        wallet.telegramId !== null &&
        wallet.telegramId === telegramId
      ) {
        user = wallet;
      }

      if (
        wallet &&
        wallet.telegramId !== null &&
        wallet.telegramId !== telegramId
      ) {
        return 'You cannot link this telegram account to this wallet, since another telegram account is already linked to it';
      }

      if (wallet && wallet.telegramId === null) {
        user = await this.prisma.users.update({
          where: { walletAddress: walletAddress },
          data: { telegramId: telegramId },
        });
      }

      if (user !== null) {
        const accessToken = jwt.sign(
          { walletAddress: user.walletAddress },
          process.env.JWT_SECRET,
          {
            expiresIn: '10m',
          },
        );

        const refreshToken = jwt.sign(
          { walletAddress: user.walletAddress },
          process.env.JWT_SECRET,
          {
            expiresIn: '7d',
          },
        );

        await this.prisma.users.update({
          where: { walletAddress },
          data: {
            refreshToken,
            refreshTokenCreatedAt: new Date(),
          },
        });

        // Установка cookie с accessToken
        res.cookie('accessToken', accessToken, {
          httpOnly: true,
          maxAge: 600000, // 10 минут в миллисекундах
        });

        return {
          user,
          accessToken,
        };
      }
    } catch (error) {
      return error;
    }
  }

  async getTokenBalance(walletAddress: string): Promise<number> {
    const web3 = new Web3(process.env.INFURA_URL);

    // Получаем баланс токенов из криптокошелька
    const balance = await web3.eth.call({
      to: '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3',
      data:
        web3.eth.abi.encodeFunctionSignature('balanceOf(address)') +
        web3.eth.abi.encodeParameters(['address'], [walletAddress]).substr(2),
    });

    return parseFloat(balance);
  }

  async calculateSubscriptionLevel(walletAddress: string): Promise<object> {
    const balance = await this.getTokenBalance(walletAddress);

    const currentTWPrice = await this.prisma.tokens.findFirst({
      where: {
        address: '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3',
      },
      select: {
        priceUSD: true,
      },
    });

    const user = await this.prisma.users.findUnique({
      where: {
        walletAddress: walletAddress,
      },
    });

    const holdingTWAmountUSDT = balance * parseFloat(currentTWPrice.priceUSD);

    if (holdingTWAmountUSDT < 2000) {
      const result = await this.prisma.subscribers.upsert({
        where: {
          walletAddress: walletAddress,
        },
        update: {
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '0',
        },
        create: {
          walletAddress: walletAddress,
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '0',
        },
      });

      return result;
    }

    if (holdingTWAmountUSDT >= 2000 && holdingTWAmountUSDT < 5000) {
      const result = await this.prisma.subscribers.upsert({
        where: {
          walletAddress: walletAddress,
        },
        update: {
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '1',
        },
        create: {
          walletAddress: walletAddress,
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '1',
        },
      });

      return result;
    }

    if (holdingTWAmountUSDT >= 5000) {
      const result = await this.prisma.subscribers.upsert({
        where: {
          walletAddress: walletAddress,
        },
        update: {
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '2',
        },
        create: {
          walletAddress: walletAddress,
          telegramId: user.telegramId,
          holdingTWAmount: balance,
          holdingTWAmountUSDT: holdingTWAmountUSDT,
          subscriptionLevel: '2',
        },
      });

      return result;
    }
  }

  async recalculateSubscriptionsLevel() {
    try {
      const subscribers = await this.prisma.subscribers.findMany();

      const currentTWPrice = await this.prisma.tokens.findFirst({
        where: { address: '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3' },
      });

      const recalculatedSubscribers = await Promise.all(
        subscribers.map(async (subscriber) => {
          const holdingTWAmount = await this.getTokenBalance(
            subscriber.walletAddress,
          );
          const holdingTWAmountUSDT =
            holdingTWAmount * parseFloat(currentTWPrice.priceUSD);

          let subscriptionLevel = '0';

          if (holdingTWAmountUSDT >= 2000 && holdingTWAmountUSDT < 5000) {
            subscriptionLevel = '1';
          }

          if (holdingTWAmountUSDT >= 5000) {
            subscriptionLevel = '2';
          }

          return {
            walletAddress: subscriber.walletAddress,
            telegramId: subscriber.telegramId,
            holdingTWAmount: holdingTWAmount,
            holdingTWAmountUSDT: holdingTWAmountUSDT,
            subscriptionLevel: subscriptionLevel,
          };
        }),
      );

      await this.prisma.subscribers.deleteMany();
      await this.prisma.subscribers.createMany({
        data: recalculatedSubscribers,
      });

      return recalculatedSubscribers;
    } catch (error) {
      return error;
    }
  }
}
