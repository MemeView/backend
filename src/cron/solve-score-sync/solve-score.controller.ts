import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Res,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SolveScoreService } from './solve-score.service';
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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthService } from 'src/auth/auth.service';
import { getAbsoluteScore } from 'src/helpers/getAbsoluteScore';

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
  async takeScore(
    @Query('take') take: string,
    @Query('skip') skip: string,
    @Query('tokenAddress') tokenAddress: string,
  ) {
    try {
      let takeNumber = await parseInt(take);
      let skipNumber = await parseInt(skip);

      if (!skipNumber) {
        skipNumber = 0;
      }

      if (!takeNumber) {
        takeNumber = 50;
      }

      if (takeNumber > 50) {
        takeNumber = 50;
      }

      const filter = tokenAddress ? { tokenAddress } : {};
      if (filter.tokenAddress) {
        takeNumber = 1;
      }

      const scores = await this.prisma.score.findMany({
        where: filter,
        skip: skipNumber,
        take: takeNumber,
        orderBy: [{ tokenScore: 'desc' }, { liquidity: 'desc' }],
      });

      const scoresQuery: string[] = [];
      scores.forEach((element) => {
        scoresQuery.push(element.tokenAddress);
      });

      const tokenList = await this.prisma.tokens.findMany({
        take: takeNumber,
        where: {
          address: {
            in: scoresQuery,
          },
        },
      });

      let result = tokenList.map((token) => {
        const score = scores.find(
          (element) => element.tokenAddress === token.address,
        );

        return {
          absoluteScore: score!.tokenScore,
          score: Math.ceil(score!.tokenScore),
          ...token,
        };
      });

      result = result.sort((a, b) => {
        if (
          getAbsoluteScore(a.absoluteScore) ===
          getAbsoluteScore(b.absoluteScore)
        ) {
          return Number(b.liquidity) - Number(a.liquidity);
        }
        return b.absoluteScore - a.absoluteScore;
      });

      return result;
    } catch (e) {
      return e;
    }
  }

  @Get('/take-free-score')
  async takeFreeScore(
    @Query('take') take: string,
    @Query('skip') skip: string,
    @Query('tokenAddress') tokenAddress: string,
  ) {
    try {
      let takeNumber = parseInt(take);
      let skipNumber = parseInt(skip);

      if (!skipNumber) {
        skipNumber = 0;
      }

      if (!takeNumber) {
        takeNumber = 50;
      }

      if (takeNumber > 50) {
        takeNumber = 50;
      }

      if (skipNumber < 30) {
        skipNumber = 30;
      }

      const filter = tokenAddress ? { tokenAddress } : {};
      if (filter.tokenAddress) {
        takeNumber = 1;
        skipNumber = 0;
      }

      const scores = await this.prisma.score.findMany({
        where: filter,
        skip: skipNumber,
        take: takeNumber,
        orderBy: [{ tokenScore: 'desc' }, { liquidity: 'desc' }],
      });

      const scoresQuery: string[] = [];
      scores.forEach((element) => {
        scoresQuery.push(element.tokenAddress);
      });

      const tokenList = await this.prisma.tokens.findMany({
        take: takeNumber,
        where: {
          address: {
            in: scoresQuery,
          },
        },
      });

      let result = tokenList.map((token) => {
        const score = scores.find(
          (element) => element.tokenAddress === token.address,
        );

        return {
          absoluteScore: score!.tokenScore,
          score: Math.ceil(score!.tokenScore),
          ...token,
        };
      });

      result = result.sort((a, b) => {
        if (
          getAbsoluteScore(a.absoluteScore) ===
          getAbsoluteScore(b.absoluteScore)
        ) {
          return Number(b.liquidity) - Number(a.liquidity);
        }
        return b.absoluteScore - a.absoluteScore;
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
      const pstDate = subHours(utcDate, 7);
      const currentPstHour = pstDate.getUTCHours();
      const sevenDaysAgo = subDays(utcDate, 7);

      const accessToken = request.cookies['accessToken'];

      // Декодируем accessToken, чтобы получить данные пользователя
      const decodedAccessToken = jwt.decode(accessToken) as {
        walletAddress: string;
        telegramId: string;
        iat: number;
        exp: number;
      };

      const user = await this.prisma.users.findUnique({
        where: {
          walletAddress: decodedAccessToken.walletAddress,
        },
      });

      let userInWhiteList = null;

      if (decodedAccessToken.telegramId) {
        userInWhiteList = await this.prisma.tgWhiteList.findUnique({
          where: { telegramId: decodedAccessToken.telegramId },
        });
      }

      if (
        (!user && !userInWhiteList) ||
        (user && !userInWhiteList && !user.subscriptionLevel)
      ) {
        return response.status(403).json({
          message: 'There is no subscription',
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

      if (user && user.subscriptionLevel === 'plan3') {
        const subscribedReferralsCount = await this.authService.checkReferrals(
          decodedAccessToken.walletAddress,
        );

        if (subscribedReferralsCount < 3) {
          return response.status(403).json({
            message: `You dont have permission to tokens score`,
          });
        }
      }

      if (
        user &&
        (user.subscriptionLevel === 'plan1' ||
          user.subscriptionLevel === 'plan2')
      ) {
        const holdingTWAmount = await this.authService.getTokenBalance(
          decodedAccessToken.walletAddress,
        );

        const plan = await this.prisma.subscriptions.findFirst({
          where: {
            title: user.subscriptionLevel,
          },
        });

        if (holdingTWAmount < plan.holdingTWAmount) {
          return response.status(403).json({
            message: `You dont have permission to tokens score`,
          });
        }
      }
      if (
        user &&
        user.subscriptionLevel !== 'plan1' &&
        user.subscriptionLevel !== 'plan2' &&
        user.subscriptionLevel !== 'plan3' &&
        user.subscriptionLevel !== 'trial' &&
        !userInWhiteList
      ) {
        return response.status(403).json({
          message: `You dont have permission to tokens score`,
        });
      }

      if (currentPstHour < 3) {
        scoreQuery = `score9pm`;
      }

      if (currentPstHour >= 3 && currentPstHour < 9) {
        if (
          (user &&
            (user.subscriptionLevel === 'plan1' ||
              user.subscriptionLevel === 'trial' ||
              user.subscriptionLevel === 'plan3')) ||
          userInWhiteList
        ) {
          scoreQuery = `score9pm`;
        } else {
          scoreQuery = `score3am`;
        }
      }

      if (currentPstHour >= 9 && currentPstHour < 15) {
        scoreQuery = `score9am`;
      }

      if (currentPstHour >= 15 && currentPstHour < 21) {
        if (
          (user &&
            (user.subscriptionLevel === 'plan1' ||
              user.subscriptionLevel === 'trial' ||
              user.subscriptionLevel === 'plan3')) ||
          userInWhiteList
        ) {
          scoreQuery = `score9am`;
        } else {
          scoreQuery = `score3pm`;
        }
      }

      if (currentPstHour >= 21) {
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
