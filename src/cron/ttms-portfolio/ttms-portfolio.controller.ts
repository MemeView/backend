import { Body, Controller, Get, Post } from '@nestjs/common';
import { TtmsPortfolioService } from './ttms-portfolio.service';
import { PrismaClient } from '@prisma/client';
import { UTCDate } from '@date-fns/utc';
import {
  getDate,
  getMonth,
  getYear,
  startOfDay,
  subDays,
  subHours,
} from 'date-fns';

type IntervalType = 24 | 48;

@Controller('/api')
export class TtmsPortfolioController {
  constructor(
    private readonly ttmsPortfolioService: TtmsPortfolioService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post('/ttms-portfolio')
  async sendMessageToAllUsers(@Body('hour') hour: number) {
    try {
      const result = await this.ttmsPortfolioService.handleTtmsPortfolio(hour);

      return result;
    } catch (e) {
      return e;
    }
  }

  @Get('/last-24-ttms-portfolio')
  async last24TtmsPortfolio() {
    try {
      const result = await this.prisma.last24SolvedTtmsPortfolio.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
      });
      const portfolioCalculatedAt = result.createdAt;
      const portfolioCalculatedAtPst = subHours(portfolioCalculatedAt, 8);
      const portfolioCalculationStartedAt = subHours(
        portfolioCalculatedAtPst,
        24,
      );

      const portfolioCalculationStartedAtUtc = new Date(
        portfolioCalculationStartedAt,
      );
      const portfolioCalculationEndedAtUtc = new Date(portfolioCalculatedAtPst);

      const portfolioCalculationStartedDay =
        portfolioCalculationStartedAtUtc.getUTCDate();
      const portfolioCalculationEndedDay =
        portfolioCalculationEndedAtUtc.getUTCDate();
      const startMonth = portfolioCalculationStartedAtUtc.getUTCMonth();
      const endMonth = portfolioCalculationEndedAtUtc.getUTCMonth();
      const startYear = portfolioCalculationStartedAtUtc.getUTCFullYear();
      const endYear = portfolioCalculationEndedAtUtc.getUTCFullYear();

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

      if (result.startedAt === '9am') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]} ${startYear}, 9am PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]} ${endYear}, 9am PST`;

        return {
          portfolio: result.portfolio,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }

      if (result.startedAt === '9pm') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]} ${startYear}, 9pm PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]} ${endYear}, 9pm PST`;

        return {
          portfolio: result.portfolio,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }
    } catch (e) {
      return e;
    }
  }

  @Get('/average-ttms-portfolio-results')
  async averageTtmsPortfolioResults() {
    try {
      const utcDate = new UTCDate();
      const todayStartOfDay = startOfDay(utcDate);
      const oneWeekAgo = subDays(todayStartOfDay, 7);
      const monthAgo = subDays(todayStartOfDay, 30);

      const lastResult24h =
        await this.prisma.averageTtmsPortfolioResults.findFirst({
          orderBy: { createdAt: 'desc' },
        });

      let averagePercentage24h = 0;
      if (lastResult24h.average24Result) {
        averagePercentage24h += parseFloat(lastResult24h.average24Result);
      }

      const resultOneWeek =
        await this.prisma.averageTtmsPortfolioResults.findMany({
          where: {
            createdAt: { gte: oneWeekAgo },
          },
        });

      const resultOneMonth =
        await this.prisma.averageTtmsPortfolioResults.findMany({
          where: {
            createdAt: { gte: monthAgo },
          },
        });

      return {
        averagePercentage24h: averagePercentage24h,
        averagePercentage7d: resultOneWeek.reduce((acc, result) => {
          return acc + parseFloat(result.average24Result);
        }, 0),
        averagePercentage30d: resultOneMonth.reduce((acc, result) => {
          return acc + parseFloat(result.average24Result);
        }, 0),
      };
    } catch (e) {
      return e;
    }
  }
}
