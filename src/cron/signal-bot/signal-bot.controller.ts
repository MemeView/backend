import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
    @Body('telegramId') telegramId: number,
  ) {
    try {
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

  @Post('/send-message-to-all-users')
  async sendMessageToAllUsers() {
    try {
      const result = await this.signalBotService.sendMessageToAllUsers();

      // let result = 0;
      // let sendedCount = 0;

      // for (let i = 0; i < 24; i++) {
      //   let utcDate;
      //   if (i < 10) {
      //     utcDate = new UTCDate(`2024-03-10T0${i}:16:23.559Z`);
      //   }
      //   if (i >= 10) {
      //     utcDate = new UTCDate(`2024-03-10T${i}:16:23.559Z`);
      //   }
      //   const pstDate = subHours(utcDate, 8);
      //   const currentHour = utcDate.getUTCHours();
      //   const currentPstHour = pstDate.getUTCHours();
      //   let allSubscriptions = null;

      //   if (i === 12) {
      //     console.log('allSubscriptions', allSubscriptions);
      //   }

      //   console.log('================');
      //   console.log('i', i);
      //   console.log('utcDate', utcDate);
      //   console.log('pstDate', pstDate);
      //   console.log('currentPstHour', currentPstHour);

      //   if (currentPstHour === 3) {
      //     console.log('отправили');
      //     allSubscriptions = await this.prisma.subscriptions.findFirst({
      //       where: {
      //         title: 'plan2',
      //       },
      //     });
      //     sendedCount++;
      //   }

      //   if (currentPstHour === 9) {
      //     console.log('отправили');
      //     allSubscriptions = await this.prisma.subscriptions.findMany();
      //     sendedCount++;
      //   }

      //   if (currentPstHour === 15) {
      //     console.log('отправили');
      //     allSubscriptions = await this.prisma.subscriptions.findFirst({
      //       where: {
      //         title: 'plan2',
      //       },
      //     });
      //     sendedCount++;
      //   }

      //   if (currentPstHour === 21) {
      //     console.log('отправили');
      //     allSubscriptions = await this.prisma.subscriptions.findMany();
      //     sendedCount++;
      //   }
      //   const allUsers = await this.prisma.users.findMany({
      //     where: {
      //       telegramId: { gt: 0 },
      //     },
      //   });

      //   allUsers.forEach(async (user) => {
      //     const chatId = user.telegramId;

      //     if (allSubscriptions && Array.isArray(allSubscriptions)) {
      //       const subscription = await allSubscriptions.find(
      //         (subscription) => subscription.title === user.subscriptionLevel,
      //       );

      //       if (subscription) {
      //         result++;
      //       }
      //     }
      //   });

      //   console.log('================');
      // }
      // console.log('sendedCount', result);

      return result;
    } catch (e) {
      return e;
    }
  }
}
