import {
  Controller,
  Get,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { PostingService } from './posting.service';
import { PrismaClient } from '@prisma/client';
import {
  addHours,
  format,
  startOfDay,
  startOfHour,
  subDays,
  subHours,
} from 'date-fns';
import { UTCDate } from '@date-fns/utc';

@Controller('api')
export class PostingController {
  constructor(
    private postingService: PostingService,
    private prisma: PrismaClient,
  ) {}

  @Post('/posting')
  async sendTelegramMessage() {
    try {
      await this.postingService.handleCombinedPosting();
    } catch (error) {
      throw new InternalServerErrorException('bad request');
    }
  }

  @Post('/posting-test')
  async sendTelegramMessageTest() {
    try {
      const utcDate = new UTCDate();
      console.log('utcDate', utcDate);

      const utcDateAddedTwoHours = addHours(utcDate, 2).toString();
      console.log('utcDateAddedTwoHours', utcDateAddedTwoHours);

      const today = startOfDay(utcDate);
      console.log('today', today);

      const yesterday = startOfDay(subDays(utcDate, 1));
      console.log('yesterday', yesterday);

      const twoDaysAgo = startOfDay(subDays(utcDate, 2));
      console.log('twoDaysAgo', twoDaysAgo);

      const currentHour = utcDate.getHours();
      console.log('currentHour', currentHour);

      const startOfCurrentHour = startOfHour(utcDate);
      console.log('startOfCurrentHour', startOfCurrentHour);

      const startOfHourOneDayAgo = startOfHour(subHours(utcDate, 24));
      console.log('startOfHourOneDayAgo', startOfHourOneDayAgo);

      const twentyFourHoursAgo = subHours(utcDate, 24);
      console.log('twentyFourHoursAgo', twentyFourHoursAgo);

      const currentUnixTimestamp: number = Math.floor(Date.now() / 1000);
      console.log('currentUnixTimestamp', currentUnixTimestamp);

      const timestampInSeconds = Math.floor(utcDate.getTime() / 1000);
      console.log('timestamp', timestampInSeconds);
    } catch (error) {
      throw new InternalServerErrorException('bad request');
    }
  }

  @Get('portfolio-auto-posting')
  async portfolioAutoPosting() {
    const result = this.postingService.portfolioAutoPosting();

    return result;
  }
}
