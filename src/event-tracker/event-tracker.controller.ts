import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EventTrackerService } from './event-tracker.service';
import * as jwt from 'jsonwebtoken';

@Controller('api')
export class EventTrackerController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventTrackerService: EventTrackerService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('/event-tracker')
  async eventTracker(
    @Req() request: Request,
    @Res() response: Response,
    @Body('track') track: string,
  ) {
    const accessToken = request.cookies['accessToken'];

    const decodedAccessToken = jwt.decode(accessToken) as {
      walletAddress: string;
      iat: number;
      exp: number;
    };

    const { walletAddress } = decodedAccessToken;

    const event = await this.eventTrackerService.eventTracker(
      walletAddress,
      track,
    );

    if (event && event.success === true) {
      return response.status(200).json({
        success: true,
        message: event.message,
      });
    } else {
      return response.status(400).json({
        success: false,
        message: 'walletAddress is not provided or track status is wrong',
      });
    }
  }
}
