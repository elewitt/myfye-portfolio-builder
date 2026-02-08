# Myfye Portfolio Builder

**An AI-powered autonomous portfolio management agent for Solana**

Built for the [Colosseum Agent Hackathon](https://colosseum.com) - Solana's first hackathon for AI agents.

---

## What It Does

The Myfye Portfolio Builder is an **autonomous AI agent** that manages crypto portfolios on Solana. Simply tell it what you want in natural language:

```
You: "I want a conservative portfolio"
Agent: Setting strategy to CONSERVATIVE. Target: USDC 50%, USDY 30%, SOL 15%, EURC 5%

You: "Rebalance my holdings"
Agent: Analyzing portfolio... Executing trades to match target allocation.
       ✓ Swapped 0.5 SOL → 90 USDC
       ✓ Swapped 45 USDC → 45 USDY
       Portfolio rebalanced successfully.
```

## Live Demo

Run the interactive demo:

```bash
# Set environment variables
export PRIVY_APP_ID="your_privy_app_id"
export PRIVY_APP_SECRET="your_privy_secret"
export WALLET_ID="your_wallet_id"
export WALLET_ADDRESS="your_wallet_address"

# Run demo
node demo.mjs
```

## Key Features

### Natural Language Interface
Talk to the agent like a human financial advisor:
- "Create a conservative portfolio"
- "I want an aggressive strategy"
- "Check my portfolio status"
- "Rebalance my holdings"
- "Swap 1 USDC to SOL"

### Autonomous Rebalancing
The agent continuously monitors your portfolio and automatically rebalances when drift exceeds your threshold:

```typescript
manager.startMonitoring(30000); // Check every 30 seconds
// Agent will auto-execute trades when allocation drifts >5%
```

### Multi-Agent Ready
Built with a simple SDK that any AI agent can use to create wallets and trade:

```typescript
import { createAgentWallet, TOKENS } from 'myfye-portfolio-builder/sdk';

const wallet = createAgentWallet({
  privyAppId: process.env.PRIVY_APP_ID,
  privyAppSecret: process.env.PRIVY_APP_SECRET,
});

// Create a new wallet for this agent
const { address } = await wallet.createWallet();

// Execute trades
await wallet.swap(TOKENS.USDC, TOKENS.SOL, "1000000"); // Swap 1 USDC to SOL
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Natural Language Input                           │
│                 "I want a conservative portfolio"                   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Autonomous Portfolio Manager                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Parser    │  │  Strategy   │  │  Executor   │                 │
│  │  NL → Intent│  │  Select &   │  │  Monitor &  │                 │
│  │             │  │  Rebalance  │  │  Trade      │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Agent Wallet SDK                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │   Wallet    │  │   Quotes    │  │   Swaps     │                 │
│  │   (Privy)   │  │  (Jupiter)  │  │  (Jupiter)  │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│     Privy       │  │     Jupiter     │  │        Solana           │
│ Server Wallets  │  │   Aggregator    │  │      Blockchain         │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
```

## Investment Strategies

| Strategy | USDC | USDY | SOL | EURC |
|----------|------|------|-----|------|
| **Conservative** | 50% | 30% | 15% | 5% |
| **Moderate** | 25% | 25% | 35% | 15% |
| **Aggressive** | 15% | 20% | 60% | 5% |

## Quick Start

### Installation

```bash
npm install
npm run build
```

### Create a Portfolio Agent

```typescript
import { createPortfolioManager } from 'myfye-portfolio-builder/agent';

const manager = createPortfolioManager({
  privyAppId: process.env.PRIVY_APP_ID,
  privyAppSecret: process.env.PRIVY_APP_SECRET,
  rebalanceThresholdPct: 5,
  minTradeUsd: 0.50,
});

// Initialize with new or existing wallet
await manager.initialize(existingWalletId);

// Process natural language commands
await manager.processCommand("Create a conservative portfolio");
await manager.processCommand("Check my status");
await manager.processCommand("Rebalance");
```

### Use the Agent Wallet SDK

```typescript
import { createAgentWallet, TOKENS } from 'myfye-portfolio-builder/sdk';

const wallet = createAgentWallet({
  privyAppId: process.env.PRIVY_APP_ID,
  privyAppSecret: process.env.PRIVY_APP_SECRET,
});

// Load existing wallet
await wallet.loadWallet('your-wallet-id');

// Get portfolio
const portfolio = await wallet.getPortfolio();
console.log(`SOL Balance: ${portfolio.solBalance}`);

// Execute swap
const result = await wallet.swap(TOKENS.USDC, TOKENS.SOL, "1000000");
console.log(`TX: https://solscan.io/tx/${result.txSignature}`);
```

## Project Structure

```
myfye-portfolio-builder/
├── sdk/
│   ├── agent-wallet.ts      # Simple wallet/trading for agents
│   ├── account.ts           # Privy wallet management
│   ├── market.ts            # Jupiter market data
│   ├── trading.ts           # Trade execution
│   ├── portfolio.ts         # Portfolio tracking
│   └── types.ts             # TypeScript types
├── agent/
│   └── autonomous-manager.ts # Autonomous portfolio manager
├── examples/
│   ├── simple-agent.ts      # Basic agent example
│   └── autonomous-demo.ts   # Interactive demo
├── demo.mjs                 # Live demo script
└── tests/
```

## Technical Highlights

### Privy Server Wallets
- Programmatically controlled wallets (no user interaction needed)
- Perfect for autonomous agents
- Self-custodial architecture

### Jupiter Integration
- Uses Jupiter Lite API for optimal routing
- Supports versioned transactions
- Dynamic slippage and compute limits
- Handles complex multi-hop swaps

### Rebalancing Engine
- Calculates drift from target allocation
- Prioritizes largest deviations
- Executes trades atomically
- Configurable thresholds

## Environment Variables

```bash
# Required
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Optional (for demo scripts)
WALLET_ID=your_wallet_id
WALLET_ADDRESS=your_wallet_address
```

## Hackathon Context

This project was built for the **Colosseum Agent Hackathon**, Solana's first hackathon specifically for AI agents.

**What makes this unique:**
1. **Natural language interface** - Talk to your portfolio manager like a human
2. **Autonomous operation** - Set it and forget it with auto-rebalancing
3. **Multi-agent architecture** - SDK designed for any AI agent to use
4. **Real trades on mainnet** - Actually executes swaps via Jupiter
5. **All code written by AI** - Following hackathon rules

## Proven Trades

The agent has executed real trades on Solana mainnet:
- USDC → SOL: `45TSw6m4NueHmYsZBU7X7G9kid3r1pLbDNEaAbpgi8YL5fWgYQLAg4yB6R5UqUZrZtgvdXjMM5PXDA1Rfx8URakP`
- SOL → USDY: `4Dgyo84QZS1T9TnYvVfniUuoHYb8G7ANVs9ESh4mCbxYzb6qS1f8K1YS3kqZVaQifJTjTAnKF9Lkds4ZWDb4L5Gg`
- USDY → USDC: `2gGQNMPQErMmogntqGUKLrMAbLpgZFHpxLxojKe6ZRboUfRmXkdYAs3bAAYup2dEWo2hR7H5WhK5UWLQaAE3cGiq`
- USDC → EURC: `4TPm1JyMvZwmwQCQRPDTUUToTaHU4yTZLc96PGnqpm3JcYqqjXehRVPiL8jc2rhpTPBj3pAeD9EFUyEnN5hMgjhw`

## License

MIT

---

Built with Claude for the Solana ecosystem
