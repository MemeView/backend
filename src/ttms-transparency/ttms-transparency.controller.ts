import { Controller, Get, Param } from '@nestjs/common';
import { TtmsTransparencyService } from './ttms-transparency.service';
import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';
import { UTCDate } from '@date-fns/utc';

@Controller('api')
export class TtmsTransparencyController {
  constructor(
    private readonly ttmsTransparencyService: TtmsTransparencyService,
    private readonly prisma: PrismaClient,
  ) {}

  @Get('/handle-ttms-transparency/:interval?/:snapshot?/:blockchain?')
  async handleTtmsTransparency(
    @Param('interval') interval: string,
    @Param('snapshot') snapshot: string,
    @Param('blockchain') blockchain: string,
  ) {
    try {
      if (!interval) {
        interval = null;
      }

      if (!snapshot) {
        snapshot = null;
      }

      if (!blockchain) {
        blockchain = null;
      }

      const result = this.ttmsTransparencyService.handleTtmsTransparency(
        interval,
        snapshot,
        blockchain,
      );

      return result;
    } catch (error) {
      return error;
    }
  }

  @Get('/ttms-transparency-dates')
  async ttmsTransparencyDates() {
    try {
      const result = await this.ttmsTransparencyService.ttmsTransparencyDates();

      return result;
    } catch (e) {
      return e;
    }
  }
}
