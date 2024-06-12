import { Module } from '@nestjs/common';
import { TradeBotController } from './trade-bot.controller';
import { TradeBotService } from './trade-bot.service';
import { CryptomusModule } from '../cryptomus/cryptomus.module';

@Module({
  controllers: [TradeBotController],
  providers: [TradeBotService],
  exports: [TradeBotService],
})
export class TradeBotModule {}
