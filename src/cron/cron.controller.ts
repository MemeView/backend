import { Controller, Get, Post } from '@nestjs/common';
import { CronService } from './cron.service';

@Controller('api')
export class CronController {
  constructor(private readonly cronService: CronService){}

  // @Post('/main-cron')
  // async mainCron() {
  //   try {
  //     await this.cronService.tokensCron();
  //     return 'ok';
  //   } catch (e) {
  //     console.error('Error', e);
  //     return { error: e.message };
  //   }
  // }
}
