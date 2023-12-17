import { Defined } from '@definedfi/sdk';

console.log(
  'DEFINE_API_KEY',
  process.env.DEFINE_API_KEY,
);
export const definedSDK = new Defined(
  process.env.DEFINE_API_KEY || '',
);
