import { Module } from '@nestjs/common';
import { PrivateBotService } from './private-bot.service';
import { PrivateBotController } from './private-bot.controller';

@Module({
  providers: [PrivateBotService],
  controllers: [PrivateBotController],
})
export class PrivateBotModule {}
