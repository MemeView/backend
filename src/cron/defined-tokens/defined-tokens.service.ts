import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  RankingDirection,
  TokenFilterResult,
  FilterTokensQuery,
  TokenRankingAttribute,
  FilterTokensQueryVariables,
} from '@definedfi/sdk/dist/sdk/generated/graphql';

import { definedSDK } from 'src/defined-api/definedSDK';

import { GET_FILTER_TOKENS } from '../../graphql/getFilterTokens';
import { Cron, Interval, Timeout } from '@nestjs/schedule';

@Injectable()
export class DefinedTokensService {
  private readonly prisma: PrismaClient;
  constructor() {
    this.prisma = new PrismaClient();
  }
  public async handleTokens() {
    const limit = 200;

    let iterationCount = 0;

    let offset = 0;

    let currentIterationResult: TokenFilterResult[] | undefined;

    let allTokens: TokenFilterResult[] = [];

    let createTimestamp: number | null = null;

    let oldTokens: Array<any> = [];

    try {
      while (!currentIterationResult || currentIterationResult.length > 0) {
        offset = limit * iterationCount;

        const { filterTokens } = await definedSDK.send<
          FilterTokensQuery,
          FilterTokensQueryVariables
        >(GET_FILTER_TOKENS, {
          limit,
          offset,
          rankings: {
            attribute: TokenRankingAttribute.CreatedAt,
            direction: RankingDirection.Asc,
          },
          filters: {
            network: [1],
            liquidity: { gt: 1000 },
            createdAt: { gt: createTimestamp },
          },
        });

        currentIterationResult =
          (filterTokens?.results as TokenFilterResult[]) || [];

        allTokens = [...allTokens, ...currentIterationResult];
        // console.log(currentIterationResult[199].token);

        console.log(
          '============================================================',
        );
        console.log('Current Iteration Index', iterationCount);
        console.log('Current Iteration Offset', offset);
        console.log('Latest Token CreateAt', createTimestamp);
        console.log('Total Tokens Count', allTokens.length);
        console.log(
          '============================================================',
        );

        iterationCount += 1;

        if (offset === 9800) {
          const lastToken =
            currentIterationResult[currentIterationResult.length - 1];

          createTimestamp = lastToken?.createdAt ?? null;

          offset = 0;

          iterationCount = 0;
        }
      }

      const resultAfterFilter = allTokens
        .filter(
          (token) =>
            !!token.token?.address &&
            token.token.symbol &&
            token.token.symbol.length <= 10 &&
            /^[a-zA-Zа-яА-Я0-9]+$/.test(token.token.symbol),
        )
        .map((token) => ({
          ...token,
          address: token.token?.address,
          name: token.token?.name,
          symbol: token.token?.symbol,
        }));

      oldTokens = await this.prisma.tokens.findMany();

      // Сначала удаляем
      const { count: deletedCount } = await this.prisma.tokens.deleteMany();

      // Потом вставляем
      const { count: addedCount } = await this.prisma.tokens.createMany({
        skipDuplicates: true,
        data: resultAfterFilter,
      });

      return { deletedCount, addedCount };
    } catch (error) {
      console.error('Error occurred:', error);
      if (oldTokens.length > 0) {
        await this.prisma.tokens.deleteMany();
        await this.prisma.tokens.createMany({
          data: oldTokens,
        });
      }
      throw error;
    }
  }
}
