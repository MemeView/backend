import { Body, Controller, Get, Post } from '@nestjs/common';
import { TtmsPortfolioService } from './ttms-portfolio.service';
import { PrismaClient } from '@prisma/client';

@Controller('/api')
export class TtmsPortfolioController {
  constructor(
    private readonly ttmsPortfolioService: TtmsPortfolioService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post('/ttms-portfolio')
  async sendMessageToAllUsers(@Body('startedAt') startedAt: '9am' | '9pm') {
    try {
      const result = await this.ttmsPortfolioService.handleTtmsPortfolio(
        startedAt,
      );
      const scoreQuery = `score${startedAt}`;
      console.log(result[scoreQuery].length);

      return result[scoreQuery];
    } catch (e) {
      return e;
    }
  }
}
