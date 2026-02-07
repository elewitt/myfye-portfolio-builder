# Myfye Portfolio Builder

**An AI-powered autonomous portfolio management agent for Solana**

Built for the [Colosseum Agent Hackathon](https://colosseum.com) - Solana's first hackathon for AI agents.

---

## Overview

The Myfye Portfolio Builder is an autonomous agent that constructs and manages investment portfolios on top of [Myfye](https://myfye.com), a self-custodial on-chain finance app on Solana. The agent:

1. **Analyzes user profiles** - Takes risk tolerance, goals, and time horizon as input
2. **Recommends strategies** - Generates personalized allocation strategies
3. **Builds portfolios** - Creates execution plans to achieve target allocations
4. **Executes trades** - Autonomously swaps tokens via Jupiter and trades RWA stocks via Dinari

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User / AI Agent                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Portfolio Builder Agent                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Strategies  │  │  Analyzer   │  │  Executor   │                 │
│  │ Conservative│  │ Profile →   │  │ Plan →      │                 │
│  │ Moderate    │  │ Strategy    │  │ Trades      │                 │
│  │ Aggressive  │  │             │  │             │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Myfye Agent SDK                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   Account   │  │   Market    │  │   Trading   │  │ Portfolio │  │
│  │   (Privy)   │  │   (Jupiter) │  │  (Jupiter/  │  │  (Solana) │  │
│  │             │  │             │  │   Dinari)   │  │           │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│     Privy       │  │     Jupiter     │  │        Dinari           │
│ Embedded Wallets│  │   Token Swaps   │  │    RWA Stocks           │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
         │                      │                      │
         └──────────────────────┴──────────────────────┘
                                │
                                ▼
                    ┌─────────────────────┐
                    │       Solana        │
                    │     Blockchain      │
                    └─────────────────────┘
```

## Features

### Myfye Agent SDK (`/sdk`)

A TypeScript library that wraps Myfye's functionality into a clean programmatic interface:

- **Account Management** - Create self-custodied wallets via Privy
- **Market Data** - Fetch token prices from Jupiter, stock prices from Dinari
- **Trading** - Execute token swaps and RWA stock trades
- **Portfolio Tracking** - Read and analyze on-chain portfolio state

```typescript
import { MyfyeSDK } from 'myfye-portfolio-builder/sdk';

const sdk = new MyfyeSDK({
  rpcUrl: 'https://api.devnet.solana.com',
  network: 'devnet',
});

// Get token prices
const solPrice = await sdk.getTokenPrice('So11111111111111111111111111111111111111112');

// Get portfolio
const portfolio = await sdk.getPortfolio(walletAddress);

// Execute swap
const result = await sdk.executeSwap({
  inputMint: COMMON_TOKENS.USDC,
  outputMint: COMMON_TOKENS.SOL,
  amount: 100,
  userPublicKey: walletAddress,
}, signer);
```

### Portfolio Builder Agent (`/agent`)

An autonomous agent that uses the SDK to build portfolios based on user profiles:

```typescript
import { createPortfolioBuilder, UserProfile } from 'myfye-portfolio-builder/agent';

const agent = createPortfolioBuilder(sdkConfig);

const profile: UserProfile = {
  riskTolerance: 'moderate',
  investmentGoals: ['growth', 'income'],
  timeHorizon: 'medium',
  totalInvestment: 1000,
};

// Analyze and get strategy
const strategy = agent.analyzeProfile(profile);

// Get recommendations
const analysis = await agent.analyzePortfolio(walletAddress, profile);

// Execute allocation
const result = await agent.executeAllocation(walletAddress, profile, signer);
```

## Investment Strategies

The agent supports three risk-based strategies:

### Conservative (Low Risk)
- 50% Stablecoins (USDC, USDT)
- 30% RWA Stocks (AAPL, MSFT, GOOG)
- 15% SOL
- 5% Other tokens

### Moderate (Balanced)
- 25% Stablecoins
- 30% RWA Stocks (mix of blue chip + growth)
- 30% SOL
- 15% Other tokens

### Aggressive (High Risk)
- 10% Stablecoins
- 20% RWA Stocks (growth-focused)
- 40% SOL
- 30% Other tokens

The agent dynamically adjusts these allocations based on user goals and time horizon.

## Quick Start

### Installation

```bash
npm install
```

### Run the Example

```bash
npm run example
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

## Project Structure

```
myfye-portfolio-builder/
├── sdk/                      # Myfye Agent SDK
│   ├── index.ts             # Main SDK exports
│   ├── account.ts           # Privy wallet management
│   ├── market.ts            # Jupiter/Dinari market data
│   ├── trading.ts           # Trade execution
│   ├── portfolio.ts         # Portfolio tracking
│   └── types.ts             # TypeScript types
├── agent/                    # Portfolio Builder Agent
│   ├── index.ts             # Agent exports
│   ├── portfolio-builder.ts # Main agent logic
│   ├── types.ts             # Agent types
│   └── strategies/          # Investment strategies
│       ├── conservative.ts
│       ├── moderate.ts
│       └── aggressive.ts
├── examples/                 # Usage examples
│   └── build-portfolio.ts
└── tests/                    # Test suites
    ├── sdk.test.ts
    └── agent.test.ts
```

## Configuration

### SDK Configuration

```typescript
interface SDKConfig {
  rpcUrl: string;           // Solana RPC URL
  heliusApiKey?: string;    // Optional Helius API key
  network: 'devnet' | 'mainnet-beta';
  privy?: {
    appId: string;
    appSecret: string;
  };
  dinari?: {
    apiKeyId: string;
    apiSecretKey: string;
    environment: 'sandbox' | 'production';
  };
}
```

### Agent Configuration

```typescript
interface PortfolioBuilderConfig {
  minTradeSize: number;        // Minimum trade size in USD (default: 10)
  maxSlippageBps: number;      // Max slippage in bps (default: 300)
  rebalanceThresholdPct: number; // Rebalance trigger (default: 5%)
  autoExecute: boolean;        // Auto-execute trades (default: false)
  includeStocks: boolean;      // Include RWA stocks (default: false)
  dryRun: boolean;             // Simulate only (default: true)
}
```

## Environment Variables

```bash
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
HELIUS_API_KEY=your_helius_key

# Privy (for embedded wallets)
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Dinari (for RWA stocks)
DINARI_API_KEY_ID=your_dinari_key_id
DINARI_API_SECRET_KEY=your_dinari_secret
```

## API Reference

### SDK Methods

| Method | Description |
|--------|-------------|
| `createAccount(email?)` | Create a new Privy embedded wallet |
| `getAvailableTokens()` | Get list of verified tokens |
| `getTokenPrice(mint)` | Get token price in USD |
| `getSwapQuote(params)` | Get Jupiter swap quote |
| `executeSwap(params, signer)` | Execute token swap |
| `getPortfolio(address)` | Get full portfolio state |
| `getAvailableStocks()` | Get Dinari RWA stocks |

### Agent Methods

| Method | Description |
|--------|-------------|
| `analyzeProfile(profile)` | Get recommended strategy for user |
| `analyzePortfolio(address, profile)` | Analyze portfolio vs target |
| `createExecutionPlan(address, profile)` | Generate trade execution plan |
| `executeAllocation(address, profile, signer)` | Execute trades |
| `rebalanceIfNeeded(address, profile, signer?)` | Check and optionally rebalance |

## Technical Details

### Jupiter Integration

- Uses Jupiter Lite API for quotes (`lite-api.jup.ag/swap/v1/quote`)
- Supports versioned transactions with address lookup tables
- Dynamic compute unit limits and slippage optimization
- Handles complex multi-hop routing

### Dinari Integration

- Supports proxied order flow for RWA stock trading
- EIP-712 typed data signing for secure orders
- Works with Base chain for stock settlements
- Includes fee estimation and order tracking

### Privy Integration

- Server-side wallet pregeneration
- Supports both Solana and EVM wallets
- Self-custodial embedded wallet architecture
- Email-linked account recovery

## Development

### Tech Stack

- **TypeScript** - Type-safe development
- **@solana/web3.js** - Solana blockchain interaction
- **Vitest** - Fast unit testing
- **Jupiter API** - DEX aggregation
- **Dinari SDK** - RWA stock trading
- **Privy API** - Embedded wallet creation

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Hackathon Context

This project was built for the **Colosseum Agent Hackathon**, Solana's first hackathon specifically for AI agents. The goal was to create an autonomous agent that can:

1. Interact with on-chain protocols (Jupiter, Dinari)
2. Make intelligent investment decisions
3. Execute trades without human intervention
4. Adapt to user preferences and market conditions

All code was written by the AI agent itself, following the hackathon rules.

## License

MIT

---

Built with for the Solana ecosystem
