import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import { HoldersService } from './holders.service';
import { PrismaClient } from '@prisma/client';
import { Response, Request } from 'express';

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
  async getHoldersUnique(
    @Query('tokenAddress') tokenAddress: string,
    @Res() response: Response,
  ) {
    try {
      if (tokenAddress === '0xc3b36424c70e0e6aee3b91d1894c2e336447dbd3') {
        const result = await this.prisma.tokenWatch.findFirst();

        return response.status(200).json({
          success: true,
          data: result,
        });
      }

      const result = await this.prisma.holders.findFirst({
        where: {
          tokenAddress: tokenAddress,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return response.status(200).json({
        success: true,
        data: result,
      });
    } catch (e) {
      console.error('Error', e);
      return response.status(400).json({
        success: true,
        error: e.message,
      });
    }
  }

  @Post('/tw-holders')
  async getTwHolders() {
    try {
      const result = await this.holdersService.handleTwHolders();

      return result;
    } catch (e) {
      console.error('Error', e);
      return e;
    }
  }
}
