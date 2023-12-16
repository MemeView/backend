import { Injectable } from '@nestjs/common';
import { subDays, startOfDay } from 'date-fns';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class VolumeService {
  constructor(private prisma: PrismaClient) {}

  async handleVolumeData() {
    const now = new Date();
    const twoDaysAgo = subDays(startOfDay(now), 2);

    const tokens = await this.prisma.tokens.findMany({
      select: {
        address: true,
        volume24: true,
      },
    });

    await this.prisma.volume.deleteMany({
      where: {
        volumeCreatedAt: {
          lt: twoDaysAgo,
        },
      },
    });

    await this.prisma.volume.createMany({ data: tokens });
  }
}
