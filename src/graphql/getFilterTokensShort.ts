export const GET_FILTER_TOKENS_SHORT = `query ($tokens: [String], $limit: Int, $offset: Int, $rankings: [TokenRanking], $filters: TokenFilters) {
    filterTokens(tokens: $tokens, limit: $limit, offset: $offset, filters: $filters, rankings: $rankings) {
      page
      count
      results {
        change24
        liquidity
        volume24
        createdAt
        priceUSD
        quoteToken
        pair {
          address
        }
        token {
          name
          symbol
          address
          networkId
        }
      }
    }
  }`;
