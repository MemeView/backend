import { Defined } from '@definedfi/sdk';

console.log(
  'NEXT_PUBLIC_DEFINE_API_KEY',
  process.env.NEXT_PUBLIC_DEFINE_API_KEY,
);
export const definedSDK = new Defined(
  process.env.NEXT_PUBLIC_DEFINE_API_KEY || '',
);
