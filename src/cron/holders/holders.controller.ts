import { Controller, Get, Res } from '@nestjs/common';
import { HoldersService } from './holders.service';

@Controller('api')
export class HoldersController {
  constructor(private readonly holdersService: HoldersService) {}

  @Get('/holders')
  async getHolders() {
    try {
      const result = await this.holdersService.handleHolders();

      return result;
    } catch (e) {
      console.error('Error', e);
      return e;
    }
  }
}
