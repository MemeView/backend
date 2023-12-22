import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Res,
} from '@nestjs/common';
import { SolveScoreService } from './solve-score.service';
import { PrismaClient } from '@prisma/client';

@Controller('api')
export class SolveScoreController {
  constructor(
    private readonly solveScoreService: SolveScoreService,
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
  async averageScore() {
    try {
      const result = await this.prisma.dailyScore.findMany();

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
}
