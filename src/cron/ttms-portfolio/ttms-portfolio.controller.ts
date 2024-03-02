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

      // console.log(parseFloat('-5%'));

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

      const utcDate = new UTCDate();
      const pstDate = subHours(utcDate, 8);
      const todayStartOfDay = startOfDay(utcDate);
      const monthAgo = subDays(utcDate, 30);
      const yesterday = subDays(pstDate, 1);
      const currentDayNumber = getDate(pstDate);
      const yesterdayDayNumber = getDate(yesterday);
      const currentMonth = getMonth(pstDate);
      const yesterdayMonth = getMonth(yesterday);
      const currentYear = getYear(pstDate);
      const yesterdayYear = getYear(yesterday);

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
        const cycleStart = `${yesterdayDayNumber} ${months[yesterdayMonth]} ${yesterdayYear}, 9am PST`;
        const cycleEnd = `${currentDayNumber} ${months[currentMonth]} ${currentYear}, 9am PST`;

        return {
          portfolio: result.portfolio,
          cycleStart: cycleStart,
          cycleEnd: cycleEnd,
        };
      }

      if (result.startedAt === '9pm') {
        const cycleStart = `${yesterdayDayNumber} ${months[yesterdayMonth]} ${yesterdayYear}, 9pm PST`;
        const cycleEnd = `${currentDayNumber} ${months[currentMonth]} ${currentYear}, 9pm PST`;

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

      const result24h = await this.prisma.averageTtmsPortfolioResults.findMany({
        where: {
          createdAt: { gte: todayStartOfDay },
        },
      });

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
        averagePercentage24h: result24h.reduce((acc, result) => {
          return acc + parseFloat(result.average24Result);
        }, 0),
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
