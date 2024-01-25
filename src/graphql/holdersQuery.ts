export const holdersQuery = (tokenId: string) =>
  `query Holders {   holders(input: { tokenId: "${tokenId}" }) {     count   } }`;
