export const GET_FILTER_TOKENS_TOKEN_WATCH = `query ($tokens: [String], $limit: Int, $offset: Int, $rankings: [TokenRanking], $filters: TokenFilters) {
    filterTokens(tokens: $tokens, limit: $limit, offset: $offset, filters: $filters, rankings: $rankings) {
      page
      count
      results {
        priceUSD
        token {
          name
          symbol
          address
          networkId
        }
      }
    }
  }`;
