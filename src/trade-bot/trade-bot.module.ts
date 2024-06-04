import { Module } from '@nestjs/common';
import { TradeBotController } from './trade-bot.controller';
import { TradeBotService } from './trade-bot.service';

@Module({
  controllers: [TradeBotController],
  providers: [TradeBotService],
})
export class TradeBotModule {}
