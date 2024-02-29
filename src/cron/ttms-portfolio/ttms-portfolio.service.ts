import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TtmsPortfolioService {
  constructor(private readonly prisma: PrismaClient) {}

  async handleTtmsPortfolio(startedAt: '9am' | '9pm') {
    try {
      const scoreQuery = `score${startedAt}`;

      const ttmsTop30 = await this.prisma.ttmsByHours.findFirst({
        where: {
          [scoreQuery]: { not: null },
        },
      });

      return ttmsTop30;
    } catch (error) {
      return error;
    }
  }
}
