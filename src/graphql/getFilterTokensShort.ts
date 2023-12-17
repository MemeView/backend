export const GET_FILTER_TOKENS_SHORT = `query ($tokens: [String], $limit: Int, $offset: Int, $rankings: [TokenRanking], $filters: TokenFilters) {
    filterTokens(tokens: $tokens, limit: $limit, offset: $offset, filters: $filters, rankings: $rankings) {
      page
      count
      results {
        createdAt
        change24
        liquidity
        volume24
        token {
          networkId
          address
          decimals
          name
          info {
            circulatingSupply
            totalSupply
            imageLargeUrl
            imageSmallUrl
          }
          networkId
          isScam
          symbol
        }
      }
    }
  }
  `;
