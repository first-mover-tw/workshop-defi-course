import type { Order } from "../../../mysten-ts-sdks/packages/deepbook-v3/dist/contracts/deepbook/order.d.mts";

export interface AggregatorInfo {
  priceAggregator: {
    objectId: string;
    initialSharedVersion: number | string;
    mutable: boolean;
  };
  pythPriceId: string;
}

export interface NetworkConfig {
  PYTH_STATE_ID: string;
  PRICE_SERVICE_ENDPOINT: string;
  WORMHOLE_STATE_ID: string;
  AGGREGATOR_OBJS: Record<string, AggregatorInfo>;
}

export type DeepbookOrder = typeof Order.$inferType;
export type Timer = ReturnType<typeof setInterval>;

export interface PositionState {
  managerId: string;
  managerKey: string;
  riskRatio: number;
  baseAsset: number;
  quoteAsset: number;
  baseDebt: number;
  quoteDebt: number;
  totalAssets: number;
  totalDebts: number;
  equity: number;
  openOrders: DeepbookOrder[];
  isLong: boolean; // Track if this is long or short position
}
