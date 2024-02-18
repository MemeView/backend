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
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { PrismaClient } from '@prisma/client';
import { UTCDate } from '@date-fns/utc';
import * as jwt from 'jsonwebtoken';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
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
  async currentSubscription(@Req() request: Request) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

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
        return null;
      }

      const subscriptionLevel = JSON.stringify({
        plan: user.subscriptionLevel,
      });

      //403 возвращать
      return JSON.parse(subscriptionLevel);
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
