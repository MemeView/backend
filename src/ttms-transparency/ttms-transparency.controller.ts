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

  @Get('/handle-ttms-transparency/:snapshot?/:blockchain?/:tokenCount?')
  async handleTtmsTransparency(
    @Param('snapshot') snapshot: SnapshotEnum,
    @Param('blockchain') blockchain: ChainEnum,
    @Param('tokenCount') tokenCount: '30' | '100',
  ) {
    try {
      if (!snapshot) {
        snapshot = SnapshotEnum.amCurrent;
      }

      if (!blockchain) {
        blockchain = ChainEnum.all;
      }

      if (!tokenCount) {
        tokenCount = '30';
      }

      if (!(snapshot in SnapshotEnum)) {
        throw new BadRequestException('Invalid snapshot value');
      }

      if (!(blockchain in ChainEnum)) {
        throw new BadRequestException('Invalid blockchain value');
      }

      if (tokenCount && tokenCount !== '30' && tokenCount !== '100') {
        throw new BadRequestException(
          'Invalid tokenCount value. Available values 30 or 100',
        );
      }

      const result = await this.ttmsTransparencyService.handleTtmsTransparency(
        snapshot,
        blockchain,
        tokenCount,
      );

      result.sort((a, b) => {
        if (b.ttms === a.ttms) {
          return parseFloat(b.liquidity) - parseFloat(a.liquidity); // Сортировка по liquidity при равных score
        }
        return b.ttms - a.ttms; // Сортировка по score
      });

      result.forEach((token, index) => {
        token['placeInTop'] = index + 1; // индекс начинается с 0, поэтому добавляем 1
      });

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
