import {
  Injectable,
  UnauthorizedException,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { isAddress } from 'ethers';
import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import Web3 from 'web3';
import { UTCDate } from '@date-fns/utc';

interface subscriber {
  walletAddress: string;
  telegramId: string;
  holdingTWAmount: string;
  holdingTWAmountUSDT: string;
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
        throw new HttpException('No such plan exists', HttpStatus.NOT_FOUND);
      }

      const user = await this.prisma.users.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress },
      });

      const accessToken = jwt.sign(
        { walletAddress: user.walletAddress, telegramId: user.telegramId },
        process.env.JWT_SECRET,
        {
          expiresIn: '10m',
        },
      );

      const refreshToken = jwt.sign(
        { walletAddress: user.walletAddress, telegramId: user.telegramId },
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
      });

      return {
        user,
        accessToken,
      };
    } catch (error) {
      return error;
    }
  }

  async refreshTokens(refreshToken: string, res: Response) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET) as {
        walletAddress: string;
        exp: number;
      };

      if (decoded) {
        const user = await this.validateUser(decoded.walletAddress);

        if (user) {
          const accessToken = jwt.sign(
            { walletAddress: user.walletAddress, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            { expiresIn: '10m' },
          );

          const refreshToken = jwt.sign(
            { walletAddress: user.walletAddress, telegramId: user.telegramId },
            process.env.JWT_SECRET,
            {
              expiresIn: '7d',
            },
          );

          return {
            accessToken,
            refreshToken,
          };
        }
      }
    } catch (error) {
      return error;
    }
  }

  async signUpWithTelegram(
    walletAddress: string,
    telegramId: number,
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
        return new HttpException(
          'You cannot link this telegram account to this wallet, since another telegram account is already linked to it',
          400,
        );
      }

      if (wallet && wallet.telegramId === null) {
        user = await this.prisma.users.update({
          where: { walletAddress: walletAddress },
          data: { telegramId: telegramId },
        });
      }

      if (user !== null) {
        const accessToken = jwt.sign(
          { walletAddress: user.walletAddress, telegramId: user.telegramId },
          process.env.JWT_SECRET,
          {
            expiresIn: '10m',
          },
        );

        const refreshToken = jwt.sign(
          { walletAddress: user.walletAddress, telegramId: user.telegramId },
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
          secure: true,
          sameSite: 'none',
          path: '/',
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

  async calculateSubscriptionLevel(
    walletAddress: string,
    plan: string,
  ): Promise<any> {
    const balance = await this.getTokenBalance(walletAddress);

    const subscription = await this.prisma.subscriptions.findFirst({
      where: {
        title: plan,
      },
    });

    if (!subscription) {
      throw new HttpException('No such plan exists', HttpStatus.NOT_FOUND);
    }

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

    if (!user) {
      return new UnauthorizedException('User not found');
    }

    const holdingTWAmountUSDT = balance * parseFloat(currentTWPrice.priceUSD);

    if (plan === 'trial' && user.freeTrialWasTaken === false) {
      const utcDate = new UTCDate();

      const result = await this.prisma.subscribers.upsert({
        where: {
          walletAddress: walletAddress,
        },
        update: {
          telegramId: user.telegramId,
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
          trialCreatedAt: utcDate,
        },
        create: {
          walletAddress: walletAddress,
          telegramId: user.telegramId,
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
          trialCreatedAt: utcDate,
        },
      });

      await this.prisma.users.update({
        where: {
          walletAddress: walletAddress,
        },
        data: {
          freeTrialWasTaken: true,
        },
      });

      return result;
    }

    if (holdingTWAmountUSDT >= subscription.holdingTWAmount) {
      const result = await this.prisma.subscribers.upsert({
        where: {
          walletAddress: walletAddress,
        },
        update: {
          telegramId: user.telegramId,
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
        },
        create: {
          walletAddress: walletAddress,
          telegramId: user.telegramId,
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
        },
      });

      return result;
    }

    return `To take this plan you must have TokenWatch on ${subscription.holdingTWAmount} USDT, but you have on ${holdingTWAmountUSDT}`;
  }
}
