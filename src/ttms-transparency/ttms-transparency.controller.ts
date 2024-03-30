import { Controller, Get, Param } from '@nestjs/common';
import { TtmsTransparencyService } from './ttms-transparency.service';
import { PrismaClient } from '@prisma/client';

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
    if (!interval) {
      interval = null;
    }

    if (!snapshot) {
      snapshot = null;
    }

    if (!blockchain) {
      blockchain = null;
    }

    console.log(interval);
    console.log(snapshot);
    console.log(blockchain);

    const result = this.ttmsTransparencyService.handleTtmsTransparency(
      interval,
      snapshot,
      blockchain,
    );

    return result;
  }
}
