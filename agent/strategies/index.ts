/**
 * Strategy Exports
 */

export { conservativeStrategy } from './conservative.js';
export { moderateStrategy } from './moderate.js';
export { aggressiveStrategy } from './aggressive.js';

import { conservativeStrategy } from './conservative.js';
import { moderateStrategy } from './moderate.js';
import { aggressiveStrategy } from './aggressive.js';
import { StrategyDefinition } from '../types.js';

/**
 * Get strategy by risk level
 */
export function getStrategy(riskLevel: 'conservative' | 'moderate' | 'aggressive'): StrategyDefinition {
  switch (riskLevel) {
    case 'conservative':
      return conservativeStrategy;
    case 'moderate':
      return moderateStrategy;
    case 'aggressive':
      return aggressiveStrategy;
    default:
      return moderateStrategy;
  }
}

/**
 * All available strategies
 */
export const strategies: StrategyDefinition[] = [
  conservativeStrategy,
  moderateStrategy,
  aggressiveStrategy,
];
