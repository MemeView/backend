import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  RankingDirection,
  TokenFilterResult,
  FilterTokensQuery,
  TokenRankingAttribute,
  FilterTokensQueryVariables,
} from '@definedfi/sdk/dist/sdk/generated/graphql';

import filterTokensQuery from '../graphql/filterTokensQuery.gql';
import { definedSDK } from 'src/defined-api/definedSDK';

import { readFileSync } from 'fs';
import { join } from 'path';

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

    try {
      while (!currentIterationResult || currentIterationResult.length > 0) {
        offset = limit * iterationCount;

        const { filterTokens } = await definedSDK.query<
          FilterTokensQuery,
          FilterTokensQueryVariables
        >(filterTokensQuery, {
          limit,
          offset,
          rankings: {
            attribute: TokenRankingAttribute.CreatedAt,
            direction: RankingDirection.Asc,
          },
          filters: { network: [1], liquidity: { gt: 1000 } },
        });

        currentIterationResult =
          (filterTokens?.results as TokenFilterResult[]) || [];

        allTokens = [...allTokens, ...currentIterationResult];

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
          const lastToken = currentIterationResult.pop();

          createTimestamp = lastToken?.createdAt ?? null;

          offset = 0;

          iterationCount = 0;
        }
      }

      // Сначала удаляем
      const deletedCount = await this.prisma.tokens.deleteMany();

      // Потом вставляем
      const addedCount = await this.prisma.tokens.createMany({
        skipDuplicates: true,
        data: allTokens
          .filter(
            (token) =>
              token?.token?.address !==
                '0x0e84296da31b6c475afc1a991db05e79633e67b0' &&
              !!token.token?.address,
          )
          .map((token) => ({
            ...token,
            address: token.token?.address,
            name: token.token?.name,
            symbol: token.token?.symbol,
          })),
      });

      return { deletedCount, addedCount };
    } catch (error) {
      console.error('Error occurred:', error);
      throw error;
    }
  }
}
