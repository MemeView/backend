import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Get,
  Query,
  Req,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaClient } from '@prisma/client';
import { UTCDate } from '@date-fns/utc';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SignalBotService } from 'src/cron/signal-bot/signal-bot.service';
import { add, differenceInMilliseconds, subDays } from 'date-fns';

@Controller('api')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly signalBotService: SignalBotService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post('/auth')
  async signUp(
    @Body('walletAddress') walletAddress: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.signUp(walletAddress, res);
      const TWAmount = await this.authService.getTokenBalance(walletAddress);

      result.user.TWAmount = TWAmount;

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: error.message });
    }
  }

  @Post('/auth-with-telegram')
  async signUpWithTelegram(
    @Body('walletAddress') walletAddress: string,
    @Body('telegramId') telegramId: number,
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.signUpWithTelegram(
        walletAddress,
        telegramId,
        res,
      );

      const TWAmount = await this.authService.getTokenBalance(walletAddress);

      result.user.TWAmount = TWAmount;

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/tw-balance-check')
  async tokenBalance(
    @Req() request: Request,
    @Res() response: Response,
    @Body('plan') plan: string,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      if (!plan) {
        return response.status(403).json({
          message: `plan not found`,
        });
      }

      if (plan === 'trial') {
        const result = await this.authService.getTokenBalance(walletAddress);
        if (result && result > 0) {
          return response.status(200).json({
            check: true,
          });
        } else {
          return response.status(200).json({
            check: false,
          });
        }
      }

      if (plan !== 'trial') {
        const balance = await this.authService.getTokenBalance(walletAddress);

        const currentTWPrice = await this.prisma.tokens.findFirst({
          where: {
            address: '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3',
          },
          select: {
            priceUSD: true,
          },
        });

        const holdingTWAmountUSDT =
          balance * parseFloat(currentTWPrice.priceUSD);

        const subscription = await this.prisma.subscriptions.findFirst({
          where: {
            title: plan,
          },
        });

        if (!subscription) {
          throw new HttpException('No such plan exists', HttpStatus.NOT_FOUND);
        }

        if (
          holdingTWAmountUSDT &&
          holdingTWAmountUSDT >= subscription.holdingTWAmount
        ) {
          return response.status(200).json({
            check: true,
          });
        } else {
          if (plan === 'plan1') {
            return response.status(200).json({
              check: false,
            });
          }
          if (plan === 'plan2') {
            return response.status(200).json({
              check: false,
            });
          }
        }
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('/check-plan')
  async currentSubscription(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        telegramId: number;
        iat: number;
        exp: number;
      };

      const { walletAddress, telegramId } = decodedAccessToken;

      const userInWhiteList = await this.prisma.tgWhiteList.findUnique({
        where: {
          telegramId: telegramId,
        },
      });

      if (userInWhiteList) {
        return response.status(200).json({
          plan: 'plan1',
          req: {
            twitter: true,
            telegram: true,
            voted: true,
            holding: true,
            trialActive: true,
            expirationDate: null,
          },
        });
      }

      const user = await this.prisma.subscribers.findUnique({
        where: {
          walletAddress: walletAddress,
        },
      });

      if (
        !user ||
        (user.subscriptionLevel !== 'trial' &&
          user.subscriptionLevel !== 'plan1' &&
          user.subscriptionLevel !== 'plan2')
      ) {
        return response.status(403).json({
          plan: null,
        });
      }

      if (user && user.subscriptionLevel === 'trial') {
        const utcDate = new UTCDate();
        const sevenDaysAgo = subDays(utcDate, 7);
        let trialActive = true;

        if (user.trialCreatedAt < sevenDaysAgo) {
          trialActive = false;
        }

        const channelId = '-1001880299449';

        const isSubscribedOnChanel =
          await this.signalBotService.checkSubscriptionByUserId(
            channelId,
            telegramId,
          );

        const userHasVoted = await this.signalBotService.checkUserHasVoted(
          walletAddress,
        );

        const tokenBalance = await this.authService.getTokenBalance(
          walletAddress,
        );

        let holdingTWAmount = false;

        if (tokenBalance > 0) {
          holdingTWAmount = true;
        }

        const twitter = true;

        if (process.env.NODE_ENV === 'development') {
          return response.status(200).json({
            plan: user.subscriptionLevel,
            req: {
              twitter: true,
              telegram: true,
              voted: false,
              holding: false,
              trialActive: true,
              expirationDate: add(user.trialCreatedAt, { days: 7 }),
            },
          });
        }

        return response.status(200).json({
          plan: user.subscriptionLevel,
          req: {
            twitter: twitter,
            telegram: isSubscribedOnChanel,
            voted: userHasVoted,
            holding: holdingTWAmount,
            trialActive: trialActive,
            expirationDate: add(user.trialCreatedAt, { days: 7 }),
          },
        });
      }

      if (
        user &&
        (user.subscriptionLevel === 'plan1' ||
          user.subscriptionLevel === 'plan2')
      ) {
        const holdingTWAmount = await this.authService.getTokenBalance(
          walletAddress,
        );

        const plan = await this.prisma.subscriptions.findFirst({
          where: {
            title: user.subscriptionLevel,
          },
        });

        if (holdingTWAmount >= plan.holdingTWAmount) {
          return response.status(200).json({
            plan: user.subscriptionLevel,
            req: {
              holding: true,
            },
          });
        }

        return response.status(403).json({
          plan: user.subscriptionLevel,
          req: {
            holding: false,
          },
        });
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/choose-subscription')
  async calculateSubscriptionLevel(
    @Body('plan') plan: string,
    @Req() request: Request,
  ) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const result = await this.authService.calculateSubscriptionLevel(
        walletAddress,
        plan,
      );

      return result;
    } catch (error) {
      throw new HttpException(error.message, 403);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/tg-white-list')
  async addToTgWhiteList(
    @Req() request: Request,
    @Res() response: Response,
    @Body('telegramIds') telegramIds: number[],
  ) {
    try {
      const usersToCreate = telegramIds.map((id) => ({ telegramId: id }));

      const { count: deletedCount } =
        await this.prisma.tgWhiteList.deleteMany();

      const { count: addedCount } = await this.prisma.tgWhiteList.createMany({
        data: usersToCreate,
      });

      return response.status(200).json({
        deleted: deletedCount,
        added: addedCount,
      });
    } catch (error) {
      throw new HttpException(error.message, 403);
    }
  }
}
