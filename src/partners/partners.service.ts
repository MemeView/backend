import { HttpException, Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaClient) {}

  async ttmsForPartners(user: string, chainId: string) {
    if (chainId !== '0' && chainId !== '1' && chainId !== '2') {
      throw new HttpException('incorrect chain', 400);
    }

    if (chainId === '2') {
      chainId = '56';
    }

    const partner = await this.prisma.partners.findUnique({
      where: {
        partnerLogin: user,
      },
    });

    if (!partner) {
      throw new HttpException('partner does not exist', 400);
    }

    let score = await this.prisma.score.findMany();
    const tokens = await this.prisma.tokens.findMany();

    if (chainId !== '0') {
      score = score.filter((e) => e.networkId === parseFloat(chainId));
    }

    let ttms = await Promise.all(
      score.map(async (score) => {
        const token = await tokens.find(
          (token) => token.address === score.tokenAddress,
        );

        if (token) {
          return {
            address: token.address,
            pair: token.pairAddress,
            chainId: chainId,
            score: score.tokenScore,
            liquidity: token.liquidity,
          };
        }
      }),
    );

    ttms = ttms.filter((e) => e);

    if (chainId === '56') {
      chainId = '2';
    }

    const tokensResult = await ttms
      .sort((a, b) => {
        if (a.score === b.score) {
          return parseFloat(b.liquidity) - parseFloat(a.liquidity);
        } else {
          return b.score - a.score;
        }
      })
      .map((token) => {
        return {
          address: token.address,
          pair: token.pair,
          chainId: chainId,
        };
      });

    return tokensResult.slice(0, 30);
  }
}
