import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { isAddress } from 'ethers';
import { ExtractJwt } from 'passport-jwt';
import { Prisma, PrismaClient, Users } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import Web3 from 'web3';
import { UTCDate } from '@date-fns/utc';
import { contractABI } from './contractABI';
import { User } from '@apollo/server/src/plugin/schemaReporting/generated/operations';
import { UserWithoutRefreshToken } from './auth-interfaces';

interface subscriber {
  walletAddress: string;
  telegramId: string;
  holdingTWAmount: string;
  holdingTWAmountUSDT: string;
  subscriptionLevel: string;
}

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

  async signUp(
    walletAddress: string,
    res: Response,
    registrationRefId?: string,
  ): Promise<{ user: UserWithoutRefreshToken; accessToken: string }> {
    // Проверка, является ли walletAddress действительным адресом кошелька Ethereum
    const isValidAddress = isAddress(walletAddress);

    if (!isValidAddress) {
      throw new HttpException('Address not valid', HttpStatus.BAD_REQUEST);
    }

    if (!registrationRefId) {
      registrationRefId = null;
    }

    let user = await this.prisma.users.upsert({
      where: { walletAddress },
      update: {},
      create: { walletAddress, registrationRefId },
    });

    if (user && (!user.ownRefId || user.ownRefId.length < 6)) {
      const refId = await this.generateRefId(user.id);
      user = await this.prisma.users.update({
        where: {
          walletAddress: user.walletAddress,
        },
        data: {
          ownRefId: refId,
        },
      });
    }

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

    const {
      refreshToken: userRefreshToken,
      refreshTokenCreatedAt,
      ...userWithoutRefreshToken
    } = user;

    return {
      user: userWithoutRefreshToken,
      accessToken,
    };
  }

  async checkReferrals(walletAddress: string) {
    try {
      const user = await this.prisma.users.findUnique({
        where: {
          walletAddress,
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }
      const ownRefId = user.ownRefId;

      const referralsList = await this.prisma.users.findMany({
        where: {
          registrationRefId: ownRefId,
        },
      });

      let count = 0;
      for (const referral of referralsList) {
        if (
          (referral.subscriptionLevel === 'plan1' ||
            referral.subscriptionLevel === 'plan2') &&
          parseFloat(referral.holdingTWAmountUSDT) >= 2000
        ) {
          count++;
        }
      }
      return count;
    } catch (error) {
      return error;
    }
  }

  async logOut(walletAddress: string, res: Response): Promise<any> {
    try {
      await this.prisma.users.update({
        where: { walletAddress },
        data: {
          refreshToken: null,
          refreshTokenCreatedAt: null,
        },
      });

      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        expires: new Date(0),
      });

      return { message: 'Logged out successfully' };
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
    registrationRefId?: string,
  ): Promise<{ user: UserWithoutRefreshToken; accessToken: string }> {
    if (!registrationRefId) {
      registrationRefId = null;
    }

    // Проверка, является ли walletAddress действительным адресом кошелька Ethereum
    const isValidAddress = isAddress(walletAddress);

    console.log('=====================');
    console.log(
      'является ли walletAddress действительным адресом кошелька Ethereum',
      isValidAddress,
    );
    console.log('=====================');

    if (!isValidAddress) {
      new UnauthorizedException('Invalid wallet address');
    }

    const wallet = await this.prisma.users.findUnique({
      where: { walletAddress: walletAddress },
    });

    let user = null;

    if (!wallet) {
      console.log('=====================');
      console.log(
        'провалились в условие, если пользователь авторизуется впервые и создаём этого пользователя',
      );
      console.log('=====================');
      user = await this.prisma.users.create({
        data: {
          walletAddress: walletAddress,
          telegramId: telegramId,
          registrationRefId: registrationRefId,
        },
      });
      if (user) {
        const refId = await this.generateRefId(user.id);
        user = await this.prisma.users.update({
          where: {
            walletAddress: user.walletAddress,
          },
          data: {
            ownRefId: refId,
          },
        });
      }
    }

    if (
      wallet &&
      wallet.telegramId !== null &&
      wallet.telegramId === telegramId
    ) {
      console.log('=====================');
      console.log(
        `провалились в условие, когда пользователь авторизуется не в первый раз 
и к нему уже привязан телеграмм аккаунт и он совпадает с тем, под которым мы сейчас авторизуемся`,
      );
      console.log('=====================');

      user = wallet;

      if (!user.ownRefId || user.ownRefId.length < 6) {
        const refId = await this.generateRefId(user.id);
        user = await this.prisma.users.update({
          where: {
            walletAddress: user.walletAddress,
          },
          data: {
            ownRefId: refId,
          },
        });
      }
    }

    if (
      wallet &&
      wallet.telegramId !== null &&
      wallet.telegramId !== telegramId
    ) {
      console.log('=====================');
      console.log(
        `провалились в условие, когда пользователь авторизуется не в первый раз 
и к нему уже привязан телеграмм аккаунт и он НЕ совпадает с тем, под которым мы сейчас авторизуемся`,
      );
      console.log('=====================');

      throw new HttpException(
        'You cannot link this telegram account to this wallet, since another telegram account is already linked to it',
        400,
      );
    }

    if (wallet && wallet.telegramId === null) {
      console.log('=====================');
      console.log(
        `провалились в условие, когда пользователь авторизуется не в первый раз,
но к нему еще не привязан телеграмм аккаунт и привязываем тот, под которым сейчас заходим`,
      );
      console.log('=====================');

      const refId = await this.generateRefId(wallet.id);
      user = await this.prisma.users.update({
        where: { walletAddress: walletAddress },
        data: {
          telegramId: telegramId,
          ownRefId: refId,
          registrationRefId: registrationRefId,
        },
      });
    }

    if (user !== null) {
      console.log('=====================');
      console.log('создаём jwt токены');
      console.log('=====================');

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

      const {
        refreshToken: userRefreshToken,
        refreshTokenCreatedAt,
        id,
        ...userWithoutRefreshToken
      } = user;

      console.log('=====================');
      console.log('пользователь зашел');
      console.log('=====================');

      return {
        user: userWithoutRefreshToken,
        accessToken,
      };
    }
  }

  async getTokenBalance(walletAddress: string): Promise<number | null> {
    const tokenAddress = '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3';

    const web3 = new Web3(process.env.INFURA_URL);

    const contract = new web3.eth.Contract(contractABI, tokenAddress);

    try {
      const balance = await contract.methods.balanceOf(walletAddress).call();

      const decimals = 18;
      return parseFloat(balance as unknown as string) / Math.pow(10, decimals);
    } catch (error) {
      console.error(error);
      return null;
    }
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

    if (subscription.title === 'plan3') {
      const subscribedReferralsCount = await this.checkReferrals(walletAddress);

      if (subscribedReferralsCount < 3) {
        throw new HttpException(
          'You dont have enouth subscribed referrals',
          403,
        );
      }

      const result = await this.prisma.users.update({
        where: {
          walletAddress: walletAddress,
        },
        data: {
          subscriptionLevel: subscription.title,
        },
      });

      return result;
    }

    const currentTWPrice = await this.prisma.tokenWatch.findFirst({
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

    if (plan === 'trial' && user.freeTrialWasTaken === true) {
      return new HttpException('you have already taken a trial period', 400);
    }

    if (plan === 'trial' && user.freeTrialWasTaken === false) {
      const utcDate = new UTCDate();

      const result = await this.prisma.users.update({
        where: {
          walletAddress: walletAddress,
        },
        data: {
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
          trialCreatedAt: utcDate,
          freeTrialWasTaken: true,
        },
      });

      return result;
    }

    if (holdingTWAmountUSDT >= subscription.holdingTWAmount) {
      const result = await this.prisma.users.update({
        where: {
          walletAddress: walletAddress,
        },
        data: {
          holdingTWAmount: JSON.stringify(balance),
          holdingTWAmountUSDT: JSON.stringify(holdingTWAmountUSDT),
          subscriptionLevel: subscription.title,
        },
      });

      return result;
    }

    return `To take this plan you must have TokenWatch on ${subscription.holdingTWAmount} USDT, but you have on ${holdingTWAmountUSDT}`;
  }

  async generateRefId(id: number): Promise<string> {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    // Преобразуем id в уникальную строку из 6 символов
    let uniqueString = '';
    while (id > 0) {
      uniqueString = characters[id % characters.length] + uniqueString;
      id = Math.floor(id / characters.length);
    }

    // Дополняем уникальную строку до 6 символов, если она короче
    while (uniqueString.length < 6) {
      uniqueString = characters[0] + uniqueString;
    }

    return uniqueString;
  }

  async checkPlanIsActive(
    walletAddress: string,
    plan: string,
  ): Promise<boolean> {
    const user = await this.prisma.users.findUnique({
      where: {
        walletAddress,
      },
    });

    const subscription = await this.prisma.subscriptions.findFirst({
      where: {
        title: plan,
      },
    });

    const balance = await this.getTokenBalance(walletAddress);

    const currentTWPrice = await this.prisma.tokenWatch.findFirst({
      where: {
        address: '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3',
      },
      select: {
        priceUSD: true,
      },
    });

    const holdingTWAmountUSDT = balance * parseFloat(currentTWPrice.priceUSD);

    if (
      holdingTWAmountUSDT &&
      holdingTWAmountUSDT >= subscription.holdingTWAmount
    ) {
      return true;
    } else {
      return false;
    }
  }
}
