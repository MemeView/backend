import { Module } from '@nestjs/common';
import { TwitterController } from './twitter.controller';
import { TwitterService } from './twitter.service';

@Module({
  controllers: [TwitterController],
  providers: [TwitterService],
})
export class TwitterModule {}
