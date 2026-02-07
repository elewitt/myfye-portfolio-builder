/**
 * Conservative Strategy
 *
 * Low-risk portfolio allocation focused on capital preservation.
 * - 50% Stablecoins (USDC, USDT)
 * - 30% RWA Stocks (blue chip: AAPL, MSFT, GOOG)
 * - 15% SOL
 * - 5% Other tokens
 */

import { StrategyDefinition } from '../types.js';
import { COMMON_TOKENS } from '../../sdk/types.js';

export const conservativeStrategy: StrategyDefinition = {
  name: 'Conservative',
  description: 'Low-risk portfolio focused on capital preservation with emphasis on stablecoins and blue-chip stocks',
  riskLevel: 'conservative',
  allocations: {
    stablecoins: 50,
    sol: 15,
    otherTokens: 5,
    stocks: 30,
  },
  recommendedAssets: {
    stablecoins: [
      {
        id: COMMON_TOKENS.USDC,
        symbol: 'USDC',
        percentageOfCategory: 70,
      },
      {
        id: COMMON_TOKENS.USDT,
        symbol: 'USDT',
        percentageOfCategory: 30,
      },
    ],
    tokens: [
      {
        id: COMMON_TOKENS.WBTC,
        symbol: 'WBTC',
        percentageOfCategory: 50,
      },
      {
        id: COMMON_TOKENS.WETH,
        symbol: 'WETH',
        percentageOfCategory: 50,
      },
    ],
    stocks: [
      {
        id: 'aapl', // Dinari stock ID placeholder
        symbol: 'AAPL',
        percentageOfCategory: 40,
      },
      {
        id: 'msft',
        symbol: 'MSFT',
        percentageOfCategory: 35,
      },
      {
        id: 'goog',
        symbol: 'GOOG',
        percentageOfCategory: 25,
      },
    ],
  },
};

export default conservativeStrategy;
