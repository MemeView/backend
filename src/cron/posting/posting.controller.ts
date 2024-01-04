import { Controller, InternalServerErrorException, Post } from '@nestjs/common';
import { PostingService } from './posting.service';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

@Controller('api')
export class PostingController {
  constructor(
    private postingService: PostingService,
    private prisma: PrismaClient,
  ) {}

  @Post('/posting')
  async sendTelegramMessage() {
    try {
      await this.postingService.handleCombinedPosting();
    } catch (error) {
      throw new InternalServerErrorException('bad request');
    }
  }

  @Post('/posting-test')
  async sendTelegramMessageTest() {
    try {
      const fileHandle = await axios.get(
        'https://tokenwatch.ai/assets/tokenwatch_post_standard.jpg',
        {
          responseType: 'arraybuffer',
        },
      );

      await this.postingService.sendEmailMessage('Test');
    } catch (error) {
      throw new InternalServerErrorException('bad request');
    }
  }
}
