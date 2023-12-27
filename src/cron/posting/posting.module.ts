import { Module } from '@nestjs/common';
import { PostingService } from './posting.service';
import { PostingController } from './posting.controller';

@Module({
  providers: [PostingService],
  controllers: [PostingController],
})
export class PostingModule {}
