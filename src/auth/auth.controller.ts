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
  @Post('/TW-balance-check')
  async tokenBalance(@Req() request: Request) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const result = await this.authService.getTokenBalance(walletAddress);
      if (result && result > 0) {
        return true;
      }

      return false;
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

      const user = await this.prisma.subscribers.findUnique({
        where: {
          walletAddress: walletAddress,
        },
      });

      if (
        !user ||
        (user.subscriptionLevel !== 'TRIAL' &&
          user.subscriptionLevel !== 'PLAN 1' &&
          user.subscriptionLevel !== 'PLAN 2')
      ) {
        return { plan: null };
      }

      if (user && user.subscriptionLevel === 'TRIAL') {
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
              voted: true,
              holding: true,
              trialActive: true,
              expirationDate: add(user.trialCreatedAt, { days: 7 }),
            },
          });
        }

        if (
          isSubscribedOnChanel === true &&
          userHasVoted === true &&
          holdingTWAmount === true &&
          twitter === true &&
          trialActive === true
        ) {
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

        return response.status(403).json({
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
        (user.subscriptionLevel === 'PLAN 1' ||
          user.subscriptionLevel === 'PLAN 2')
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
      return error;
    }
  }
}
