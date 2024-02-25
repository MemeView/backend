import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Res,
  Query,
  Post,
  UseGuards,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { SolveScoreService } from './solve-score.service';
import { PrismaClient } from '@prisma/client';
import { UTCDate } from '@date-fns/utc';
import {
  getDate,
  getMonth,
  getYear,
  parseISO,
  subDays,
  subHours,
} from 'date-fns';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthService } from 'src/auth/auth.service';
import { RefreshMiddleware } from 'src/auth/refresh-jwt.middleware';
import { useMiddleware } from 'graphql-config/typings/helpers';
import { format } from 'path';

@Controller('api')
export class SolveScoreController {
  constructor(
    private readonly solveScoreService: SolveScoreService,
    private readonly authService: AuthService,
    private prisma: PrismaClient,
  ) {}

  @Get('/solve-score-sync')
  async getScore() {
    try {
      const results = await this.solveScoreService.solveScores();
      return {
        success: true,
        message: 'Scores calculated successfully.',
        data: results,
      };
    } catch (e) {
      throw new HttpException(
        {
          success: false,
          error: `An error occurred while trying to fetch the data: ${e.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/calculate-average-score-sync')
  async calculateAverageScore() {
    try {
      await this.solveScoreService.updateDailyScores();

      return {
        success: true,
        message: 'Average scores calculated successfully.',
      };
    } catch (e) {
      throw new HttpException(
        {
          success: false,
          error: `An error occurred while trying to fetch the data: ${e.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/average-score')
  async averageScore(@Query('tokenAddress') tokenAddress: string) {
    if (!tokenAddress) {
      throw new HttpException(
        {
          success: false,
          error: `Token address is required`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.prisma.dailyScore.findUnique({
        where: {
          tokenAddress,
        },
      });

      if (!result) {
        return {
          success: true,
          result: {
            tokenAddress,
            averageScoreToday: null,
            averageScore24Ago: null,
            averageScore48Ago: null,
          },
        };
      }

      return {
        success: true,
        result,
      };
    } catch (e) {
      throw new HttpException(
        {
          success: false,
          error: `An error occurred while trying to fetch the data: ${e.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/holders-test')
  async holdersTest() {
    try {
      // const result = await this.solveScoreService.solveHoldersScore();

      const result = await this.prisma.tokens.findFirst({
        where: { address: '0xba7d68081d430d2d3443417c547aee9b4a0d0a8b' },
      });

      return {
        success: true,
        result,
      };
    } catch (e) {
      throw new HttpException(
        {
          success: false,
          error: `An error occurred while trying to fetch the data: ${e.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('/take-score')
  async takeScore() {
    try {
      const result = await this.prisma.score.findMany({
        orderBy: {
          tokenScore: 'desc',
        },
      });

      return result;
    } catch (e) {
      return e;
    }
  }

  @Get('/ttms-by-hours')
  @UseGuards(JwtAuthGuard)
  async ttmsByHours(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      let scoreQuery = ``;
      const utcDate = new UTCDate();
      const hour = utcDate.getHours();
      const sevenDaysAgo = subDays(utcDate, 7);

      const accessToken = request.cookies['accessToken'];

      // Декодируем accessToken, чтобы получить данные пользователя
      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        telegramId: number;
        iat: number;
        exp: number;
      };

      const user = await this.prisma.users.findUnique({
        where: {
          walletAddress: decodedAccessToken.walletAddress,
        },
      });

      const userInWhiteList = await this.prisma.tgWhiteList.findUnique({
        where: { telegramId: decodedAccessToken.telegramId },
      });

      if ((!user && !userInWhiteList) || !user.subscriptionLevel) {
        return response.status(403).json({
          message: `There is no subscription`,
        });
      }

      if (
        user &&
        user.subscriptionLevel === 'trial' &&
        user.trialCreatedAt < sevenDaysAgo
      ) {
        return response.status(403).json({
          message: `Your trial period has already expired`,
        });
      }

      if (
        user &&
        user.subscriptionLevel !== 'plan1' &&
        user.subscriptionLevel !== 'plan2' &&
        user.subscriptionLevel !== 'trial' &&
        !userInWhiteList
      ) {
        return response.status(403).json({
          message: `You dont have permission to tokens score`,
        });
      }

      if (hour < 3) {
        scoreQuery = `score9pm`;
      }

      if (hour >= 3 && hour < 9) {
        if (
          (user &&
            (user.subscriptionLevel === 'plan1' ||
              user.subscriptionLevel === 'trial')) ||
          userInWhiteList
        ) {
          scoreQuery = `score9pm`;
        } else {
          scoreQuery = `score3am`;
        }
      }

      if (hour >= 9 && hour < 15) {
        scoreQuery = `score9am`;
      }

      if (hour >= 15 && hour < 21) {
        if (
          (user &&
            (user.subscriptionLevel === 'plan1' ||
              user.subscriptionLevel === 'trial')) ||
          userInWhiteList
        ) {
          scoreQuery = `score9am`;
        } else {
          scoreQuery = `score3pm`;
        }
      }

      if (hour >= 21) {
        scoreQuery = `score9pm`;
      }

      const result = await this.prisma.ttmsByHours.findFirst({
        where: {
          [scoreQuery]: { not: null },
        },
        orderBy: {
          id: 'desc',
        },
        select: {
          [scoreQuery]: true,
          createdAt: true,
        },
      });

      const dateString = result.createdAt;

      const year = getYear(dateString);
      const month = getMonth(dateString); // (начинает с 0 для января)
      const day = getDate(dateString);

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

      const calculatedOn = `${
        months[month]
      } ${day}, ${year} at ${scoreQuery.substring(scoreQuery.length - 3)}`;

      return {
        calculatedOn: calculatedOn,
        data: result[scoreQuery],
      };
    } catch (e) {
      return e;
    }
  }
}
