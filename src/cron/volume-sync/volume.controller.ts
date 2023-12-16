import { Controller, Get, Res } from '@nestjs/common';
import { VolumeService } from './volume.service';
import { Response } from 'express';

@Controller('api/volume-sync')
export class VolumeController {
  constructor(private volumeService: VolumeService) {}

  @Get()
  async getAllTokens(@Res() res: Response) {
    try {
      const result = await this.volumeService.handleVolumeData();
      return res.status(200).json({
        success: true,
        message: `All volumes have been added`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `An error occurred: ${error.message}`,
      });
    }
  }
}
