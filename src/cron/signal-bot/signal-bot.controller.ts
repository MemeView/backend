import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SignalBotService } from './signal-bot.service';
import { Response, Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import * as jwt from 'jsonwebtoken';
import { UTCDate } from '@date-fns/utc';
import { subHours } from 'date-fns';

@Controller('/api')
export class SignalBotController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly signalBotService: SignalBotService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/check-subscription-to-channel')
  async checkSubscriptionToChannel(
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

      const userId = telegramId;
      const channelId = '-1001880299449';

      const result = await this.signalBotService.checkSubscriptionByUserId(
        channelId,
        userId,
      );

      if (result === true) {
        return response.status(200).json({
          check: true,
        });
      } else {
        return response.status(200).json({
          check: false,
        });
      }
    } catch (e) {
      return e;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('/check-user-has-voted')
  async checkUserHasVoted(@Req() request: Request, @Res() response: Response) {
    try {
      const accessToken = request.cookies['accessToken'];

      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        telegramId: number;
        iat: number;
        exp: number;
      };

      const { walletAddress } = decodedAccessToken;

      const userHasVoted = await this.signalBotService.checkUserHasVoted(
        walletAddress,
      );

      if (userHasVoted === true) {
        return response.status(200).json({
          check: true,
        });
      } else {
        return response.status(200).json({
          check: false,
        });
      }
    } catch (e) {
      return e;
    }
  }
}
