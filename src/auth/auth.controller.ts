import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { PrismaClient } from '@prisma/client';

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

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: error.message });
    }
  }

  @Post('/auth-with-telegram')
  async signUpWithTelegram(
    @Body('walletAddress') walletAddress: string,
    @Body('telegramId') telegramId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.authService.signUpWithTelegram(
        walletAddress,
        telegramId,
        res,
      );

      return res.status(HttpStatus.OK).json(result);
    } catch (error) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ error: error.message });
    }
  }

  @Get('/TW-balance-check')
  async tokenBalance(@Query('walletAddress') walletAddress: string) {
    try {
      const result = await this.authService.getTokenBalance(walletAddress);

      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @Post('/create-subs')
  async createSubs() {
    try {
      const result = await this.prisma.subscriptions.create({
        data: {
          title: 'PLAN 1',
          subTitle: 'Signals 2 times a day',
          description:
            'You will be messaged with Top-30 tokens 2 times a day: 9am and 9pm PST',
          period: 'infinity',
          holdingTWAmount: 2000,
        },
      });

      const result2 = await this.prisma.subscriptions.create({
        data: {
          title: 'PLAN 2',
          subTitle: 'Signals 4 times a day',
          description:
            'You will be messaged with Top-30 tokens 2 times a day: 3am, 9am, 3pm, and 9pm PST.',
          period: 'infinity',
          holdingTWAmount: 5000,
        },
      });

      return { result, result2 };
    } catch (error) {
      return error;
    }
  }
}
