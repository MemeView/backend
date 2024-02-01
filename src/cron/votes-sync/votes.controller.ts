import { Controller, Post } from '@nestjs/common';
import { VotesService } from './votes.service';
import { PrismaClient } from '@prisma/client';

@Controller('api')
export class VotesController {
  constructor(
    private votesService: VotesService,
    private prisma: PrismaClient,
  ) {}

  @Post('auto-voting')
  async autoVoting() {
    try {
      const result = await this.votesService.handleAutoVoting();

      return result;
    } catch (error) {
      return error;
    }
  }
}
