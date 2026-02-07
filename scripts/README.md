# Delta-Neutral Market Making Bot for DeepBook V3

A sophisticated trading bot built with **Bun** that maintains delta-neutral positions while accumulating trading volume on DeepBook V3's margin trading platform.

## Why Bun?

This bot is optimized for Bun runtime for:
- ? **Fast startup** - Bun starts ~4x faster than Node.js
- ?? **Lower memory** - Bun uses less memory for long-running processes
- ?? **Native TypeScript** - No transpilation needed
- ??? **Better DX** - Built-in test runner, bundler, and package manager

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0.0 or higher
- A Sui wallet with funds for trading
- DeepBook V3 balance and margin managers set up

### Installation

```bash
# Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# Clone or download the bot files
cd deepbook-delta-neutral-bot

# Install dependencies
bun install

# Copy environment template
cp .env.example .env

# Edit .env and add your SUI_PRIVATE_KEY
nano .env
```

### Configuration

Edit `.env` file:

```bash
SUI_PRIVATE_KEY=suiprivkey1...
TARGET_LEVERAGE=3
CHECK_INTERVAL=30000
ORDER_REFRESH_INTERVAL=60000
```

### Running the Bot

```bash
# Run setup check
bun run setup.ts

# Start the integrated bot (recommended)
bun run start

# Or run with auto-reload for development
bun run dev

# Run monitoring only (no trading)
bun run monitor
```

## Architecture Overview

The bot consists of three main components:

1. **Position Monitor** (`delta-neutral-bot.ts`) - Standalone position monitoring and rebalancing
2. **Trading Strategy** (`trading-strategy.ts`) - Order generation and market making logic
3. **Integrated Bot** (`integrated-bot.ts`) - Full-featured bot combining both components

## Core Concepts

### Delta Neutrality

The bot maintains two margin positions:
- **Long Position (Primary)**: Net positive base asset (SUI) exposure
- **Short Position (Secondary)**: Net negative base asset (SUI) exposure

By keeping these balanced, the portfolio is hedged against price movements while capturing spread from market making.

### Risk Management

The bot uses risk ratios to ensure safety:

```
risk_ratio = total_assets / total_debts
```

**Risk Thresholds:**
- **Target Risk Ratio**: 2.0 (50% LTV) - Safe operating level
- **Min Risk Ratio**: 1.5 (Warning zone for 3x leverage)
- **Emergency Risk Ratio**: 1.2 (Critical level)
- **Liquidation Risk Ratio**: 1.1 (DeepBook will liquidate)

### Leverage Management

- **Maximum Available**: 5x (SUI/USDC pool)
- **Bot Default**: 3x (safer margin of safety)
- **Formula**: `max_leverage Å 1 / (1 - 1/min_borrow_ratio)`

## Key Features

### 1. Automatic Position Rebalancing

The bot monitors positions every 30 seconds and rebalances when:
- Any position approaches danger zone (risk ratio < 1.5)
- Risk ratio difference between positions exceeds threshold (0.3)

**Rebalancing Process:**
1. Cancel all open orders from both positions
2. Withdraw quote (USDC) from safer position
3. Deposit into riskier position
4. Restore both positions to target risk ratio

### 2. Automated Market Making

The bot places limit orders on both sides of the market:
- **Spread**: 0.5% (configurable)
- **Levels**: 3 orders per side (configurable)
- **Level Spacing**: 0.2% between orders
- **Refresh Rate**: Every 60 seconds

**Order Structure:**
```
ASKS (Sells)
  3.15 USDC - 10 SUI  [+0.7%]
  3.13 USDC - 10 SUI  [+0.5%]
  3.11 USDC - 10 SUI  [+0.3%]
------- MID: 3.10 -------
  3.09 USDC - 10 SUI  [-0.3%]
  3.07 USDC - 10 SUI  [-0.5%]
  3.05 USDC - 10 SUI  [-0.7%]
BIDS (Buys)
```

### 3. Emergency Handling

When any position hits emergency risk ratio:
- Halts order placement
- Triggers immediate rebalancing
- Logs critical warnings

### 4. Delta Imbalance Tracking

Monitors total base asset exposure across all positions:
```
delta_imbalance = ?(baseAsset - baseDebt)
```

Target: < 1 SUI absolute imbalance

## Configuration

```typescript
interface BotConfig {
  targetLeverage: number;        // 3x recommended
  rebalanceThreshold: number;    // 0.3 = rebalance when diff > 0.3
  checkInterval: number;         // 30000ms = 30 seconds
  orderRefreshInterval: number;  // 60000ms = 1 minute
  minRiskRatio: number;          // 1.5 for 3x leverage
  targetRiskRatio: number;       // 2.0 (safe level)
  emergencyRiskRatio: number;    // 1.2 (critical level)
  maxLeverage: number;           // 5 (pool maximum)
}
```

## Usage

### Setup

```bash
SUI_PRIVATE_KEY=suiprivkey1...
TARGET_LEVERAGE=3
CHECK_INTERVAL=30000
ORDER_REFRESH_INTERVAL=60000
```

### Running the Bot

```bash
# Run setup check
bun run setup.ts

# Start the integrated bot (recommended)
bun run start

# Or run with auto-reload for development
bun run dev

# Run monitoring only (no trading)
bun run monitor
```

## Architecture Overview
import { IntegratedDeltaNeutralBot } from './integrated-bot';

const bot = new IntegratedDeltaNeutralBot(
  privateKey,
  balanceManagers,
  marginManagers,
  {
    targetLeverage: 3,
    checkInterval: 30000,
    orderRefreshInterval: 60000,
  }
);

bot.start();
```

**Option 2: Position Monitor Only**
```typescript
import { DeltaNeutralBot } from './delta-neutral-bot';

const bot = new DeltaNeutralBot(
  privateKey,
  balanceManagers,
  marginManagers
);

bot.start();
```

**Option 3: Custom Strategy**
```typescript
import { DeltaNeutralStrategy } from './trading-strategy';

const strategy = new DeltaNeutralStrategy(client, keypair, {
  spread: 0.005,
  orderSize: 10,
  numLevels: 3,
});

await strategy.refreshOrders(managerKeys, getOpenOrders);
```

## Monitoring

The bot logs comprehensive information:

```
=== Position Status ===
primary (LONG): RR: 1.850, Equity: $250.50, Orders: 6
secondary (SHORT): RR: 1.720, Equity: $230.20, Orders: 6
Delta Imbalance: 0.0523 SUI

=== Refreshing Orders ===
Placing BID @ 3.0900 x 10 [primary]
Placing ASK @ 3.1100 x 10 [primary]
Orders placed: 0x1234...
```

## Risk Considerations

### Interest Rate Risk
- USDC borrow rates vary with pool utilization
- At 80% utilization: ~12% APR
- At 90% utilization: ~62% APR
- Interest accrues continuously and increases debt

### Liquidation Risk
With 3x leverage:
- **15% adverse move**: Near liquidation
- **20% adverse move**: Liquidation occurs
- Partial liquidation: Only repays enough to restore target ratio
- Liquidation penalty: 5% (2% liquidator + 3% pool)

### Oracle Risk
- Prices from Pyth oracles may lag during volatility
- Protocol rejects prices older than 60 seconds
- EWMA validation prevents anomalous spikes

### Market Risk
- Crypto markets can move 10-20% in hours
- Flash crashes can trigger liquidations
- Ensure sufficient margin of safety

## Best Practices

1. **Start with Lower Leverage**
   - Begin with 2x instead of 3x
   - Increase gradually as you gain confidence

2. **Monitor Actively**
   - Check logs regularly
   - Set up alerting for emergency conditions
   - Keep additional funds ready for margin calls

3. **Maintain Reserves**
   - Keep extra USDC available for deposits
   - Don't deploy 100% of capital

4. **Test in Testnet First**
   - Validate all functionality
   - Understand rebalancing behavior
   - Test emergency scenarios

5. **Adjust for Market Conditions**
   - Reduce leverage during high volatility
   - Widen spreads during uncertain markets
   - Consider pausing during major events

## Profit Sources

1. **Spread Capture**: Earn the bid-ask spread on filled orders
2. **Volume Rebates**: Accumulate trading volume for potential rewards
3. **Market Making Incentives**: Participate in DeepBook incentive programs

## Cost Considerations

1. **Interest Payments**: Borrowing costs on debt
2. **Gas Fees**: Transaction costs for order placement/cancellation
3. **Liquidation Penalties**: If risk management fails
4. **Slippage**: On rebalancing transactions

## Advanced Features

### Custom Rebalancing Logic

Override `needsRebalancing()` to implement custom strategies:
```typescript
needsRebalancing(positions: PositionState[]): RebalanceDecision {
  // Custom logic here
  // Consider: time of day, volatility, market depth, etc.
}
```

### Dynamic Spread Adjustment

Adjust spreads based on volatility:
```typescript
const volatility = calculateVolatility();
const spread = baseSpread * (1 + volatility);
strategy.updateConfig({ spread });
```

### Multi-Pool Support

Extend to trade multiple pools:
```typescript
const pools = ['SUI_USDC', 'DEEP_USDC', 'WAL_USDC'];
// Manage positions across multiple pools
```

## Troubleshooting

### Orders Not Filling
- Check spread is competitive
- Verify sufficient liquidity in pool
- Ensure order sizes are reasonable

### Frequent Rebalancing
- Increase `rebalanceThreshold`
- Check if positions are too small
- Review market volatility

### High Interest Costs
- Monitor pool utilization
- Consider reducing leverage
- Close positions during high utilization

### Emergency Stops
- Check risk ratios
- Verify oracle prices
- Ensure sufficient collateral

## License

MIT

## Disclaimer

This bot involves substantial risk. Margin trading can result in losses exceeding your initial investment. Use at your own risk. This code is provided for educational purposes. Always test thoroughly before deploying with real funds.
