import {
  Controller,
  Get,
  HttpStatus,
  HttpException,
  Res,
} from '@nestjs/common';
import { SolveScoreService } from './solve-score.service';

@Controller('api/solve-score-sync')
export class SolveScoreController {
  constructor(private readonly solveScoreService: SolveScoreService) {}

  @Get()
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
}
