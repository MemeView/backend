import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  RankingDirection,
  TokenFilterResult,
  FilterTokensQuery,
  TokenRankingAttribute,
  FilterTokensQueryVariables,
} from '@definedfi/sdk/dist/sdk/generated/graphql';

import { GET_FILTER_TOKENS_SHORT } from 'src/graphql/getFilterTokensShort';
import { GraphqlService } from '../../graphql/graphql.service';

@Injectable()
export class DefinedTokensService {
  private readonly prisma: PrismaClient;
  private readonly graphqlService: GraphqlService;

  constructor() {
    this.prisma = new PrismaClient();
    this.graphqlService = new GraphqlService();
  }

  public async handleTokens(outerIteration: number) {
    const limit = 200;

    let iterationCount = 0;

    let offset = 0;

    let currentIterationResult: TokenFilterResult[] | undefined;

    let allTokens: TokenFilterResult[] = [];

    let createTimestamp: number | null = null;

    if (outerIteration > 1) {
      const lastCronToken = await this.prisma.tokens.findFirst({
        where: {
          cronCount: outerIteration - 1,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      createTimestamp = lastCronToken?.createdAt ?? null;

      if (!createTimestamp) {
        throw new Error(`Токены во внешней итерации ${outerIteration - 1} отсутствуют`);
      }
    }

    let oldTokens: Array<any> = [];

    try {
      while (!currentIterationResult || currentIterationResult.length > 0) {
        offset = limit * iterationCount;

        const result = await this.graphqlService.makeQuery<
          FilterTokensQuery,
          FilterTokensQueryVariables
        >(GET_FILTER_TOKENS_SHORT, {
          limit,
          offset,
          rankings: {
            attribute: TokenRankingAttribute.CreatedAt,
            direction: RankingDirection.Asc,
          },
          filters: {
            network: [1],
            liquidity: { gt: 5000 },
            ...(createTimestamp && { createdAt: { gt: createTimestamp } }),
          },
        });

        const { filterTokens } = result;

        if (!filterTokens.count) {
          break;
        }

        currentIterationResult =
          (filterTokens?.results as TokenFilterResult[]) || [];

        allTokens = [...allTokens, ...currentIterationResult];

        console.log('=========================================');
        console.log(`Outer Iteration: ${outerIteration}, Inner Iteration: ${iterationCount}, Offset: ${offset}`);
        console.log(`Outer Iteration ${outerIteration} Total Tokens Count`, allTokens.length);
        console.log('=========================================');

        iterationCount += 1;

        if (offset === 4800) {
          break;
        }
      }

      const blacklistTokens = await this.prisma.blacklist.findMany();

      const resultAfterFilter = allTokens
        .filter(
          (token) =>
            !!token.token?.address &&
            token.token.symbol &&
            token.token.symbol.length <= 10 &&
            /^[a-zA-Zа-яА-Я0-9]+$/.test(token.token.symbol) &&
            !blacklistTokens.some(
              (blacklistedToken) =>
                blacklistedToken.tokenAddress === token.token.address,
            ),
        )
        .map(
          ({
            token,
            pair,
            change24,
            liquidity,
            volume24,
            createdAt,
            quoteToken,
          }) => ({
            change24,
            volume24,
            liquidity,
            createdAt,
            quoteToken,
            name: token.name,
            symbol: token.symbol,
            address: token.address,
            token: token,
            pairAddress: pair?.address,
            cronCount: outerIteration,
          }),
        );

      console.log('=========================================');

      console.log('Total tokens count after filter', resultAfterFilter.length);

      console.log('=========================================');

      oldTokens = await this.prisma.tokens.findMany();

      // Сначала удаляем
      let deletedCount;
      if (outerIteration != 1) {
        const { count } = await this.prisma.tokens.deleteMany({
          where: { cronCount: outerIteration },
        });
        deletedCount = count;
      } else {
        const { count } = await this.prisma.tokens.deleteMany();
        deletedCount = count;
      }

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
