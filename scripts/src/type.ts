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
