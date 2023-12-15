import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DefinedTokensModule } from './defined-tokens/defined-tokens.module';
import { GraphQLModule } from '@nestjs/graphql';

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
    }),
    DefinedTokensModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
