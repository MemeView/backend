import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PartnersService } from './partners.service';
import { Request, Response } from 'express';
import { UTCDate } from '@date-fns/utc';
import { subHours } from 'date-fns';

@Controller('api')
export class PartnersController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pertnersService: PartnersService,
  ) {}

  @Get('/ttms-for-partners')
  async ttmsForPartners(
    @Query('user') user: string,
    @Query('chainId') chainId: string,
    @Res() response: Response,
  ) {
    try {
      // const utcDate = new UTCDate();

      if (!user) {
        return response.status(400).json({
          error: 'user is not provided',
          status: 400,
        });
      }

      if (!chainId) {
        return response.status(400).json({
          error: 'chainId is not provided',
          status: 400,
        });
      }

      const result = await this.pertnersService.ttmsForPartners(user, chainId);

      const utcDate = new Date(result.date);
      const pstDate = subHours(utcDate, 7);
      const currentPstHour = pstDate.getUTCHours();
      const currentPstDay = pstDate.getUTCDate();
      const currentPstMonth = pstDate.getUTCMonth();

      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];

      const currentPstHourFormat = currentPstHour > 12 ? 'pm' : 'am';

      const timeStamp = `${currentPstHour}${currentPstHourFormat} ${currentPstDay} ${months[currentPstMonth]} by PST`;

      return response.status(200).json({
        timeStamp,
        token: result.tokens,
      });
    } catch (e) {
      if (e instanceof HttpException) {
        return response.status(e.getStatus()).json({
          error: e.message,
          status: e.getStatus(),
        });
      } else {
        throw e;
      }
    }
  }
}
