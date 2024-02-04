import { Injectable } from '@nestjs/common';
import { subDays, startOfDay } from 'date-fns';
import { PrismaClient } from '@prisma/client';
import { UTCDate } from '@date-fns/utc';

@Injectable()
export class VolumeService {
  constructor(private prisma: PrismaClient) {}

  async handleVolumeData() {
    const utcDate = new UTCDate();

    const today = startOfDay(utcDate);

    const twoDaysAgo = startOfDay(subDays(utcDate, 2));


    const tokens = await this.prisma.tokens.findMany({
      select: {
        address: true,
        volume24: true,
        change24: true,
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
  }
}
