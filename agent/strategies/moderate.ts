/**
 * Moderate Strategy
 *
 * Balanced portfolio with mix of growth and stability.
 * - 25% Stablecoins
 * - 30% SOL
 * - 15% Other tokens (established projects)
 * - 30% RWA Stocks (mix of blue chip + growth)
 */

import { StrategyDefinition } from '../types.js';
import { COMMON_TOKENS } from '../../sdk/types.js';

export const moderateStrategy: StrategyDefinition = {
  name: 'Moderate',
  description: 'Balanced portfolio with mix of growth and stability, suitable for medium-term investors',
  riskLevel: 'moderate',
  allocations: {
    stablecoins: 25,
    sol: 30,
    otherTokens: 15,
    stocks: 30,
  },
  recommendedAssets: {
    stablecoins: [
      {
        id: COMMON_TOKENS.USDC,
        symbol: 'USDC',
        percentageOfCategory: 80,
      },
      {
        id: COMMON_TOKENS.USDT,
        symbol: 'USDT',
        percentageOfCategory: 20,
      },
    ],
    tokens: [
      {
        id: COMMON_TOKENS.WBTC,
        symbol: 'WBTC',
        percentageOfCategory: 30,
      },
      {
        id: COMMON_TOKENS.WETH,
        symbol: 'WETH',
        percentageOfCategory: 30,
      },
      {
        id: COMMON_TOKENS.RAY,
        symbol: 'RAY',
        percentageOfCategory: 20,
      },
      {
        id: COMMON_TOKENS.BONK,
        symbol: 'BONK',
        percentageOfCategory: 20,
      },
    ],
    stocks: [
      {
        id: 'aapl',
        symbol: 'AAPL',
        percentageOfCategory: 25,
      },
      {
        id: 'msft',
        symbol: 'MSFT',
        percentageOfCategory: 25,
      },
      {
        id: 'nvda',
        symbol: 'NVDA',
        percentageOfCategory: 25,
      },
      {
        id: 'tsla',
        symbol: 'TSLA',
        percentageOfCategory: 25,
      },
    ],
  },
};

export default moderateStrategy;
