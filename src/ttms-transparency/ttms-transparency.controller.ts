import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { TtmsTransparencyService } from './ttms-transparency.service';
import { PrismaClient } from '@prisma/client';
import { subHours } from 'date-fns';
import { UTCDate } from '@date-fns/utc';
import { SnapshotEnum, ChainEnum } from './interfaces';

@Controller('api')
export class TtmsTransparencyController {
  constructor(
    private readonly ttmsTransparencyService: TtmsTransparencyService,
    private readonly prisma: PrismaClient,
  ) {}

  @Get('/handle-ttms-transparency/:snapshot?/:blockchain?')
  async handleTtmsTransparency(
    @Param('snapshot') snapshot: SnapshotEnum,
    @Param('blockchain') blockchain: ChainEnum,
  ) {
    try {
      if (!snapshot) {
        snapshot = SnapshotEnum.amCurrent;
      }

      if (!blockchain) {
        blockchain = ChainEnum.all;
      }

      if (!(snapshot in SnapshotEnum)) {
        throw new BadRequestException('Invalid snapshot value');
      }

      if (!(blockchain in ChainEnum)) {
        throw new BadRequestException('Invalid blockchain value');
      }

      const result = await this.ttmsTransparencyService.handleTtmsTransparency(
        snapshot,
        blockchain,
      );

      const averagePortfolioResult = result.reduce(
        (acc, curr) => acc + parseFloat(curr.resultPercentage),
        0,
      );

      return {
        result,
        averagePortfolioResult: averagePortfolioResult / 30,
      };
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
