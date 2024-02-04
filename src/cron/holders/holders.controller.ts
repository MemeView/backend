import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { HoldersService } from './holders.service';
import { PrismaClient } from '@prisma/client';

@Controller('api')
export class HoldersController {
  constructor(
    private readonly holdersService: HoldersService,
    private readonly prisma: PrismaClient,
  ) {}

  @Post('/holders')
  async getHolders() {
    try {
      const result = await this.holdersService.handleHolders(1);

      return result;
    } catch (e) {
      console.error('Error', e);
      return e;
    }
  }

  @Post('/calculate-holders')
  async calculateHolders() {
    try {
      const result = await this.holdersService.handleHoldersScore();

      return result;
    } catch (e) {
      console.error('Error', e);
      return e;
    }
  }

  @Get('/take-holders')
  async getHoldersUnique(@Query('tokenAddress') tokenAddress: string) {
    try {
      const result = await this.prisma.holders.findFirst({
        where: {
          tokenAddress: tokenAddress,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return result;
    } catch (e) {
      console.error('Error', e);
      return e;
    }
  }
}
