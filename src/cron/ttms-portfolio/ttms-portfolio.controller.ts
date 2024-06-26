import {
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
} from '@nestjs/common';
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
import { portfolio } from 'src/ttms-transparency/interfaces';

type IntervalType = '24' | '48';

type networkIdType =
  | '1'
  | '56'
  | '8453'
  | '10'
  | '42161'
  | '43114'
  | '137'
  | '1399811149'
  | 'all';

interface portfolioScheduleResult {
  percentage: string;
  interval: string;
  createdAt: Date;
}

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

  @Get('/last-24-ttms-portfolio/:interval')
  async last24TtmsPortfolio(@Param('interval') interval: IntervalType) {
    try {
      if (!interval) {
        throw new HttpException('interval in url is required', 400);
      }

      const result = await this.prisma.last24SolvedTtmsPortfolio.findFirst({
        where: {
          interval: parseFloat(interval),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      Object.entries(result.portfolio).forEach(async ([key, value]) => {
        value.exitPrice =
          await this.ttmsPortfolioService.convertFromScientificNotation(
            value.exitPrice,
          );
      });

      let portfolioStartedAtInterval = 24;

      if (interval === '48') {
        portfolioStartedAtInterval = 48;
      }

      const portfolioCalculatedAt = result.createdAt;
      const portfolioCalculatedAtPst = subHours(portfolioCalculatedAt, 8);
      const portfolioCalculationStartedAt = subHours(
        portfolioCalculatedAtPst,
        portfolioStartedAtInterval,
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

        const portfolio = Object.values(result.portfolio)
          .sort((a, b) => {
            if (a.score === b.score) {
              return parseFloat(b.liquidity) - parseFloat(a.liquidity);
            } else {
              return b.score - a.score;
            }
          })
          .slice(0, 30);

        return {
          portfolio: portfolio,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }

      if (result.startedAt === '9pm') {
        const cycleStart = `${portfolioCalculationStartedDay} ${months[startMonth]} ${startYear}, 9pm PST`;
        const cycleEnd = `${portfolioCalculationEndedDay} ${months[endMonth]} ${endYear}, 9pm PST`;

        const portfolio = Object.values(result.portfolio)
          .sort((a, b) => {
            if (a.score === b.score) {
              return parseFloat(b.liquidity) - parseFloat(a.liquidity);
            } else {
              return b.score - a.score;
            }
          })
          .slice(0, 30);

        return {
          portfolio: portfolio,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }
    } catch (e) {
      return e;
    }
  }

  @Get('/average-ttms-portfolio-results/:interval')
  async averageTtmsPortfolioResults(@Param('interval') interval: IntervalType) {
    try {
      const utcDate = new UTCDate();
      const todayStartOfDay = startOfDay(utcDate);
      const oneWeekAgo = subDays(todayStartOfDay, 7);
      const monthAgo = subDays(todayStartOfDay, 30);

      if (!interval) {
        throw new HttpException('interval in url is required', 400);
      }

      const intervalRow = `average${interval}Result`;

      const lastResult24h =
        await this.prisma.averageTtmsPortfolioResults.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { [intervalRow]: true },
        });

      let averagePercentage24h = 0;
      if (lastResult24h[intervalRow]) {
        averagePercentage24h += parseFloat(lastResult24h[intervalRow]);
      }

      const resultOneWeek =
        await this.prisma.averageTtmsPortfolioResults.findMany({
          where: {
            createdAt: { gte: oneWeekAgo },
          },
          select: { [intervalRow]: true },
        });

      const resultOneMonth =
        await this.prisma.averageTtmsPortfolioResults.findMany({
          where: {
            createdAt: { gte: monthAgo },
          },
          select: { [intervalRow]: true },
        });

      return {
        lastAveragePercentage: averagePercentage24h,
        averagePercentage7d: resultOneWeek.reduce((acc, result) => {
          return acc + parseFloat(result[intervalRow]);
        }, 0),
        averagePercentage30d: resultOneMonth.reduce((acc, result) => {
          return acc + parseFloat(result[intervalRow]);
        }, 0),
      };
    } catch (e) {
      return e;
    }
  }

  @Get('/average-ttms-portfolio-results-schedule/:networkId?')
  async averageTtmsPortfolioResultsSchedule(
    @Param('networkId') networkId: networkIdType,
  ) {
    try {
      if (!networkId) {
        networkId = 'all';
      }
      if (
        networkId &&
        ![
          '1',
          '56',
          '8453',
          '10',
          '42161',
          '43114',
          '137',
          '1399811149',
          'all',
        ].includes(networkId)
      ) {
        throw new HttpException('incorrect networkId', 400);
      }
      const utcDate = new UTCDate();
      const todayStartOfDay = startOfDay(utcDate);
      const oneWeekAgo = subDays(todayStartOfDay, 7);
      const monthAgo = subDays(todayStartOfDay, 30);

      const portfolioResults =
        await this.prisma.averageTtmsPortfolioResults.findMany({
          where: {
            createdAt: {
              gte: monthAgo,
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 60,
        });

      let average24resultQuery = 'average24Result';
      let average48resultQuery = 'average48Result';

      if (networkId !== 'all') {
        average24resultQuery = `average24ResultOn${networkId}Network`;
        average48resultQuery = `average48ResultOn${networkId}Network`;
      }

      const result24 = portfolioResults.map((result) => {
        return {
          percentage: result[average24resultQuery],
          interval: result.startedAt,
          createdAt: result.createdAt,
        };
      });

      const result48 = portfolioResults.map((result) => {
        return {
          percentage: result[average48resultQuery],
          interval: result.startedAt,
          createdAt: result.createdAt,
        };
      });

      return { result24, result48 };
    } catch (e) {
      throw new HttpException(e.message, e.status);
    }
  }
}
