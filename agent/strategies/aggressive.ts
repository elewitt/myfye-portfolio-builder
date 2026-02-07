/**
 * Aggressive Strategy
 *
 * High-risk, high-reward portfolio focused on growth.
 * - 10% Stablecoins
 * - 40% SOL
 * - 30% Other tokens (higher risk/reward)
 * - 20% RWA Stocks (growth-focused)
 */

import { StrategyDefinition } from '../types.js';
import { COMMON_TOKENS } from '../../sdk/types.js';

export const aggressiveStrategy: StrategyDefinition = {
  name: 'Aggressive',
  description: 'High-risk portfolio focused on maximum growth, suitable for long-term investors with high risk tolerance',
  riskLevel: 'aggressive',
  allocations: {
    stablecoins: 10,
    sol: 40,
    otherTokens: 30,
    stocks: 20,
  },
  recommendedAssets: {
    stablecoins: [
      {
        id: COMMON_TOKENS.USDC,
        symbol: 'USDC',
        percentageOfCategory: 100,
      },
    ],
    tokens: [
      {
        id: COMMON_TOKENS.WBTC,
        symbol: 'WBTC',
        percentageOfCategory: 20,
      },
      {
        id: COMMON_TOKENS.WETH,
        symbol: 'WETH',
        percentageOfCategory: 20,
      },
      {
        id: COMMON_TOKENS.RAY,
        symbol: 'RAY',
        percentageOfCategory: 20,
      },
      {
        id: COMMON_TOKENS.BONK,
        symbol: 'BONK',
        percentageOfCategory: 25,
      },
      {
        id: COMMON_TOKENS.SRM,
        symbol: 'SRM',
        percentageOfCategory: 15,
      },
    ],
    stocks: [
      {
        id: 'nvda',
        symbol: 'NVDA',
        percentageOfCategory: 35,
      },
      {
        id: 'tsla',
        symbol: 'TSLA',
        percentageOfCategory: 35,
      },
      {
        id: 'coin',
        symbol: 'COIN',
        percentageOfCategory: 30,
      },
    ],
  },
};

export default aggressiveStrategy;
