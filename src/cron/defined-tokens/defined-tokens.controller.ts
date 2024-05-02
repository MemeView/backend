import { Controller, Get, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { DefinedTokensService } from './defined-tokens.service';
import { GraphqlService } from '../../graphql/graphql.service';
import { PrismaClient } from '@prisma/client';

@Controller('api')
export class DefinedTokensController {
  constructor(
    private readonly definedTokensService: DefinedTokensService,
    private readonly prisma: PrismaClient,
  ) {}

  @Get()
  async getDefinedTokens(@Res() response: Response) {
    try {
      let totalDeletedCount = 0;
      let totalAddedCount = 0;

      for (let i = 1; i <= 6; i++) {
        const networkId = 1;
        const { deletedCount, addedCount } =
          await this.definedTokensService.handleTokens(i, networkId);
        totalDeletedCount += deletedCount;
        totalAddedCount += addedCount;
      }
      response.status(200).json({ totalDeletedCount, totalAddedCount });
    } catch (e) {
      console.error('Error', e);
      response.status(400).json({ error: e.message });
    }
  }

  @Post('/defined-tokenwatch')
  async handleTokenWatch() {
    const result = await this.definedTokensService.handleTokenWatch();

    return result;
  }

  @Get('/networks-stats')
  async handleNetworksStats() {
    const tokens = await this.prisma.tokens.findMany();

    const eth = tokens.filter((e) => e.networkId === 1);
    const bsc = tokens.filter((e) => e.networkId === 56);
    const base = tokens.filter((e) => e.networkId === 8453);
    const op = tokens.filter((e) => e.networkId === 10);
    const arb = tokens.filter((e) => e.networkId === 42161);
    const avax = tokens.filter((e) => e.networkId === 43114);
    const matic = tokens.filter((e) => e.networkId === 137);
    const sol = tokens.filter((e) => e.networkId === 1399811149);

    return {
      eth: {
        networkId: 1,
        count: eth.length,
      },
      bsc: {
        networkId: 56,
        count: bsc.length,
      },
      base: {
        networkId: 8453,
        count: base.length,
      },
      op: {
        networkId: 10,
        count: op.length,
      },
      arb: {
        networkId: 42161,
        count: arb.length,
      },
      avax: {
        networkId: 43114,
        count: avax.length,
      },
      matic: {
        networkId: 137,
        count: matic.length,
      },
      sol: {
        networkId: 1399811149,
        count: sol.length,
      },
    };
  }
}
