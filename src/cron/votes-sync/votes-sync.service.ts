import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class VotesSyncService {
  constructor(private prisma: PrismaClient) {}

  public async handleAutoVoting() {
    try {
      const bestTokens = await this.prisma.score.findMany({
        orderBy: {
          tokenScore: 'desc',
        },
        take: 50,
      });
    } catch (error) {
      return error;
    }
  }
}
