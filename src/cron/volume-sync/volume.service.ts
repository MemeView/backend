import { Injectable } from '@nestjs/common';
import { subDays, startOfDay } from 'date-fns';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class VolumeService {
  constructor(private prisma: PrismaClient) {}

  startOfUtcDay(date: Date) {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
  }

  async handleVolumeData() {
    const now = new Date();
    const today = this.startOfUtcDay(now);
    const yesterday = this.startOfUtcDay(subDays(now, 1));
    const twoDaysAgo = this.startOfUtcDay(subDays(now, 2));

    const tokens = await this.prisma.tokens.findMany({
      select: {
        address: true,
        volume24: true,
      },
    });

    const { count: deletedCount } = await this.prisma.volume.deleteMany({
      where: {
        OR: [
          { volumeCreatedAt: { gte: today } },
          { volumeCreatedAt: { lt: twoDaysAgo } },
        ],
      },
    });
    console.log('deletedCount', deletedCount);

    const { count: addedCount } = await this.prisma.volume.createMany({
      data: tokens,
    });
    console.log('addedCount', addedCount);
    console.log(
      await this.prisma.volume.findFirst({
        where: { volumeCreatedAt: { gte: today } },
      }),
    );
  }
}
