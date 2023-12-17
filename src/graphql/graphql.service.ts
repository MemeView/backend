import { Injectable } from '@nestjs/common';
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import gql from 'graphql-tag';

@Injectable()
export class GraphqlService {
  private readonly client: ApolloClient<any>;

  constructor() {
    const cache = new InMemoryCache();

    const link = new HttpLink({
      uri: process.env.DEFINE_API_HOST,
      headers: { Authorization: process.env.DEFINE_API_KEY || '' },
    });

    this.client = new ApolloClient({
      cache,
      link,
    });
  }

  async makeQuery<R, V>(query: string, variables?: V) {
    const response = await this.client.query<R, V>({
      query: gql`
          ${query}
      `,
      variables,
    });

    return response.data;
  }
}
