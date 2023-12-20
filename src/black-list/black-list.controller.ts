import { Body, Controller, Post } from '@nestjs/common';
import { BlackListService } from './black-list.service';

@Controller('api')
export class BlackListController {
  constructor(private readonly blackListService: BlackListService) {}

  @Post('/add-to-blacklist')
  public async addToBlacklist(
    @Body('tokenAddress') tokenAddress: string,
  ): Promise<string> {
    await this.blackListService.addTokenToBlacklist(tokenAddress);
    return 'TokenAddress was added to black list';
  }

  @Post('/remove-from-blacklist')
  public async removeFromBlacklist(
    @Body('tokenAddress') tokenAddress: string,
  ): Promise<string> {
    await this.blackListService.deleteTokenFromBlacklist(tokenAddress);
    return 'TokenAddress was removed from black list';
  }
}
