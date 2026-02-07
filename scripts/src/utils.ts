import { logger } from "./logger";

/**
 * Calculate leverage from risk ratio
 */
export function leverageFromRiskRatio(riskRatio: number): number {
  if (riskRatio <= 1) return Infinity;
  return 1 / (1 - 1 / riskRatio);
}

/**
 * Calculate risk ratio from leverage
 */
export function riskRatioFromLeverage(leverage: number): number {
  if (leverage <= 1) return Infinity;
  return 1 / (1 - 1 / leverage);
}

/**
 * Calculate LTV (Loan-to-Value) from risk ratio
 */
export function ltvFromRiskRatio(riskRatio: number): number {
  return 1 / riskRatio;
}

/**
 * Calculate how much collateral to add to reach target risk ratio
 */
export function calculateCollateralNeeded(
  currentAssets: number,
  currentDebts: number,
  targetRiskRatio: number,
): number {
  // target = (assets + X) / debts
  // X = (target * debts) - assets
  return targetRiskRatio * currentDebts - currentAssets;
}

/**
 * Calculate how much collateral can be safely withdrawn
 */
export function calculateWithdrawableCollateral(
  currentAssets: number,
  currentDebts: number,
  minRiskRatio: number,
): number {
  // After withdrawing X: (assets - X) / debts >= minRiskRatio
  // X <= assets - (minRiskRatio * debts)
  return Math.max(0, currentAssets - minRiskRatio * currentDebts);
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  baseAsset: number,
  quoteAsset: number,
  baseDebt: number,
  quoteDebt: number,
  liquidationRatio: number,
  currentBasePrice: number,
): { longLiqPrice: number; shortLiqPrice: number } {
  // For a long position (bought base with borrowed quote):
  // At liquidation: (baseAsset * price + quoteAsset) / (baseDebt * price + quoteDebt) = liquidationRatio
  // Solving for price when long (baseAsset > baseDebt):
  // longLiqPrice = (liquidationRatio * quoteDebt - quoteAsset) / (baseAsset - liquidationRatio * baseDebt)

  const netBase = baseAsset - baseDebt;
  const netQuote = quoteAsset - quoteDebt;

  let longLiqPrice = 0;
  let shortLiqPrice = 0;

  if (netBase > 0) {
    // Long position - liquidated when price falls
    longLiqPrice =
      (liquidationRatio * quoteDebt - quoteAsset) /
      (baseAsset - liquidationRatio * baseDebt);
  } else if (netBase < 0) {
    // Short position - liquidated when price rises
    shortLiqPrice =
      (quoteAsset - liquidationRatio * quoteDebt) /
      (liquidationRatio * baseDebt - baseAsset);
  }

  return { longLiqPrice, shortLiqPrice };
}

/**
 * Calculate maximum position size for given leverage
 */
export function calculateMaxPositionSize(
  equity: number,
  targetLeverage: number,
): number {
  return equity * targetLeverage;
}

/**
 * Calculate expected interest cost
 */
export function calculateInterestCost(
  debtAmount: number,
  annualRate: number,
  days: number,
): number {
  return debtAmount * (annualRate / 365) * days;
}

/**
 * Calculate break-even price considering costs
 */
export function calculateBreakEven(
  entryPrice: number,
  spread: number,
  interestRate: number,
  holdingDays: number,
): { bidBreakEven: number; askBreakEven: number } {
  const interestCost = (interestRate / 365) * holdingDays;

  return {
    bidBreakEven: entryPrice * (1 - spread - interestCost),
    askBreakEven: entryPrice * (1 + spread + interestCost),
  };
}

/**
 * Validate position safety
 */
export function validatePositionSafety(
  riskRatio: number,
  thresholds: {
    target: number;
    warning: number;
    danger: number;
    liquidation: number;
  },
): {
  status: "safe" | "warning" | "danger" | "critical";
  message: string;
} {
  if (riskRatio >= thresholds.target) {
    return {
      status: "safe",
      message: `Position is safe at ${riskRatio.toFixed(3)}`,
    };
  } else if (riskRatio >= thresholds.warning) {
    return {
      status: "warning",
      message: `Position in warning zone at ${riskRatio.toFixed(3)}`,
    };
  } else if (riskRatio >= thresholds.danger) {
    return {
      status: "danger",
      message: `Position in danger zone at ${riskRatio.toFixed(3)}`,
    };
  } else {
    return {
      status: "critical",
      message: `Position CRITICAL at ${riskRatio.toFixed(3)} - liquidation imminent!`,
    };
  }
}

/**
 * Format position summary for logging
 */
export function formatPositionSummary(position: {
  managerKey: string;
  riskRatio: number;
  equity: number;
  totalAssets: number;
  totalDebts: number;
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
  openOrders: any[];
}): string {
  const leverage = leverageFromRiskRatio(position.riskRatio);
  const ltv = ltvFromRiskRatio(position.riskRatio);

  return `
Position: ${position.managerKey}
?? Risk Ratio: ${position.riskRatio.toFixed(3)}
?? Leverage: ${leverage.toFixed(2)}x
?? LTV: ${(ltv * 100).toFixed(1)}%
?? Equity: $${position.equity.toFixed(2)}
?? Assets: $${position.totalAssets.toFixed(2)}
?? Debts: $${position.totalDebts.toFixed(2)}
?? Base: ${position.baseAsset.toFixed(4)} SUI (debt: ${position.baseDebt.toFixed(4)})
?? Quote: ${position.quoteAsset.toFixed(2)} USDC (debt: ${position.quoteDebt.toFixed(2)})
?? Open Orders: ${position.openOrders.length}
  `.trim();
}

/**
 * Calculate portfolio metrics
 */
export function calculatePortfolioMetrics(
  positions: Array<{
    equity: number;
    totalAssets: number;
    totalDebts: number;
    riskRatio: number;
    baseAsset: number;
    baseDebt: number;
  }>,
) {
  const totalEquity = positions.reduce((sum, p) => sum + p.equity, 0);
  const totalAssets = positions.reduce((sum, p) => sum + p.totalAssets, 0);
  const totalDebts = positions.reduce((sum, p) => sum + p.totalDebts, 0);
  const avgRiskRatio =
    positions.reduce((sum, p) => sum + p.riskRatio, 0) / positions.length;

  // Calculate delta exposure
  const netBaseExposure = positions.reduce(
    (sum, p) => sum + (p.baseAsset - p.baseDebt),
    0,
  );

  const portfolioLeverage = totalAssets / totalEquity;
  const portfolioLTV = totalDebts / totalAssets;

  return {
    totalEquity,
    totalAssets,
    totalDebts,
    avgRiskRatio,
    portfolioLeverage,
    portfolioLTV,
    netBaseExposure,
    isDeltaNeutral: Math.abs(netBaseExposure) < 1,
    equityWeightedRiskRatio:
      positions.reduce((sum, p) => sum + p.riskRatio * p.equity, 0) /
      totalEquity,
  };
}

/**
 * Simulate position after price move
 */
export function simulatePriceMove(
  position: {
    baseAsset: number;
    quoteAsset: number;
    baseDebt: number;
    quoteDebt: number;
  },
  currentPrice: number,
  priceChange: number, // percentage, e.g., -0.1 for -10%
): {
  newRiskRatio: number;
  newEquity: number;
  equityChange: number;
  equityChangePercent: number;
} {
  const newPrice = currentPrice * (1 + priceChange);

  const currentAssets = position.baseAsset * currentPrice + position.quoteAsset;
  const currentDebts = position.baseDebt * currentPrice + position.quoteDebt;
  const currentEquity = currentAssets - currentDebts;

  const newAssets = position.baseAsset * newPrice + position.quoteAsset;
  const newDebts = position.baseDebt * newPrice + position.quoteDebt;
  const newEquity = newAssets - newDebts;

  return {
    newRiskRatio: newAssets / newDebts,
    newEquity,
    equityChange: newEquity - currentEquity,
    equityChangePercent: ((newEquity - currentEquity) / currentEquity) * 100,
  };
}

/**
 * Calculate optimal order sizes based on equity
 */
export function calculateOptimalOrderSizes(
  equity: number,
  numLevels: number,
  targetExposure: number = 0.1, // 10% of equity per level
): number[] {
  const baseSize = (equity * targetExposure) / numLevels;

  // Increase size slightly for levels further from mid
  return Array.from({ length: numLevels }, (_, i) => {
    const multiplier = 1 + i * 0.1; // 10% increase per level
    return baseSize * multiplier;
  });
}

/**
 * Check if time to rebalance based on cooldown
 */
export function shouldRebalance(
  lastRebalanceTime: number,
  cooldownMs: number = 300000, // 5 minutes default
): boolean {
  return Date.now() - lastRebalanceTime > cooldownMs;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calculate risk-adjusted position size
 */
export function calculateRiskAdjustedSize(
  baseSize: number,
  riskRatio: number,
  targetRiskRatio: number,
): number {
  // Reduce size if risk ratio is below target
  if (riskRatio < targetRiskRatio) {
    const riskFactor = riskRatio / targetRiskRatio;
    return baseSize * riskFactor;
  }
  return baseSize;
}

/**
 * Log position health check
 */
export function logHealthCheck(
  position: any,
  thresholds: {
    target: number;
    warning: number;
    danger: number;
    liquidation: number;
  },
) {
  const safety = validatePositionSafety(position.riskRatio, thresholds);

  const symbol =
    safety.status === "safe"
      ? "?"
      : safety.status === "warning"
        ? "?"
        : safety.status === "danger"
          ? "??"
          : "??";

  logger.info(`${symbol} ${safety.message}`);

  if (safety.status !== "safe") {
    const needed = calculateCollateralNeeded(
      position.totalAssets,
      position.totalDebts,
      thresholds.target,
    );
    logger.info(`  ?? Need $${needed.toFixed(2)} to reach target safety`);
  }
}

export default {
  leverageFromRiskRatio,
  riskRatioFromLeverage,
  ltvFromRiskRatio,
  calculateCollateralNeeded,
  calculateWithdrawableCollateral,
  calculateLiquidationPrice,
  calculateMaxPositionSize,
  calculateInterestCost,
  calculateBreakEven,
  validatePositionSafety,
  formatPositionSummary,
  calculatePortfolioMetrics,
  simulatePriceMove,
  calculateOptimalOrderSizes,
  shouldRebalance,
  formatDuration,
  calculateRiskAdjustedSize,
  logHealthCheck,
};
