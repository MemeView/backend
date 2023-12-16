import { Module, Global } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Global()
@Module({
  providers: [PrismaClient],
  exports: [PrismaClient],
})
export class PrismaModule {}
