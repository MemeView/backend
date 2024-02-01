import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class VotesService {
  constructor(private prisma: PrismaClient) {}

  public async handleAutoVoting() {
    try {
      const bestTokens = await this.prisma.score.findMany({
        orderBy: {
          tokenScore: 'desc',
        },
        take: 50,
      });

      const randomTokens = bestTokens
        .sort(() => Math.random() - 0.5)
        .slice(0, 20);

      // const randomWalletAddress = await this.generateRandomWalletAddress();

      let uniqueWallets = 0;
      let entryCount = 0;

      const arrayToCreate: { tokenAddress: string; walletAddress: string }[] =
        [];

      for (const token of randomTokens) {
        const iterations = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < iterations; i++) {
          const randomWalletAddress = await this.generateRandomWalletAddress();
          uniqueWallets++;
          let voteIterations = Math.floor(Math.random() * 4) + 2;
          if (voteIterations > 4) {
            voteIterations = voteIterations - (voteIterations - 5);
          }

          for (let i = 0; i < voteIterations; i++) {
            await arrayToCreate.push({
              tokenAddress: token.tokenAddress,
              walletAddress: randomWalletAddress,
            });
            entryCount++;
          }
        }
      }
      await this.prisma.votes.createMany({ data: arrayToCreate });

      return `создано ${entryCount} голосов от ${uniqueWallets} уникальных польователей`;
    } catch (error) {
      return error;
    }
  }

  async generateRandomWalletAddress(): Promise<string> {
    const characters = 'abcdef0123456789';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += characters[Math.floor(Math.random() * characters.length)];
    }
    return address;
  }
}
