import { HoldersInput } from '@definedfi/sdk/dist/resources/graphql';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GraphqlService } from 'src/graphql/graphql.service';
import { holdersQuery } from 'src/graphql/holdersQuery';

@Injectable()
export class HoldersService {
  private readonly prisma: PrismaClient;
  private readonly graphqlService: GraphqlService;

  constructor() {
    this.prisma = new PrismaClient();
    this.graphqlService = new GraphqlService();
  }

  public async handleHolders() {
    try {
      const tokenAddresses = await this.prisma.tokens.findMany({
        select: {
          address: true,
        },
        take: 5,
      });

      for (const token of tokenAddresses) {
        console.log(token.address + ':1');
        const result = await this.graphqlService.makeQuery<
          HoldersInput,
          HoldersInput
        >(holdersQuery(token.address + ':1'), {
          cursor: null,
          tokenId: token.address + ':1',
        });

        console.log(result);
      }

      return 'ok';
    } catch (error) {
      return error;
    }
  }
}
