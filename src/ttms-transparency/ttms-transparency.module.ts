import { Module } from '@nestjs/common';
import { TtmsTransparencyController } from './ttms-transparency.controller';
import { TtmsTransparencyService } from './ttms-transparency.service';

@Module({
  controllers: [TtmsTransparencyController],
  providers: [TtmsTransparencyService],
})
export class TtmsTransparencyModule {}
