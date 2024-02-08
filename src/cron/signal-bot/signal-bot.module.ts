import { Module } from '@nestjs/common';
import { SignalBotService } from './signal-bot.service';
import { SignalBotController } from './signal-bot.controller';

@Module({
  providers: [SignalBotService],
  controllers: [SignalBotController],
})
export class SignalBotModule {}
