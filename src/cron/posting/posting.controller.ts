import { Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { PostingService } from './posting.service';
import { PrismaClient } from '@prisma/client';

@Controller('api')
export class PostingController {
  constructor(
    private telegramService: PostingService,
    private prisma: PrismaClient,
  ) {}

  @Post('/posting')
  async sendTelegramMessage() {
    try {
      await this.prisma.postedTokens.deleteMany();
      await this.telegramService.handleCombinedPosting();
    } catch (error) {
      throw new InternalServerErrorException('bad request');
    }
  }
}
