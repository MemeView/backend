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
import { UTCDate } from '@date-fns/utc';

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

  @Post('/choose-subscription')
  async calculateSubscriptionLevel(
    @Body('walletAddress') walletAddress: string,
    @Body('plan') plan: string,
  ) {
    try {
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
