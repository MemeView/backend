import { Module } from '@nestjs/common';
import { VolumeController } from './volume.controller';
import { VolumeService } from './volume.service';

@Module({
  controllers: [VolumeController],
  providers: [VolumeService],
})
export class VolumeModule {}
