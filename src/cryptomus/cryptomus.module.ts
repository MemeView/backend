import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CryptomusController } from './cryptomus.controller';
import { TradeBotService } from '../trade-bot/trade-bot.service';
import { TradeBotModule } from '../trade-bot/trade-bot.module';

@Module({
  imports: [TradeBotModule, TradeBotModule],
  controllers: [CryptomusController],
  providers: [PrismaClient],
})
export class CryptomusModule {}
