import type { NetworkConfig } from "./type";

export const CONFIG: Record<"mainnet" | "testnet", NetworkConfig> = {
  mainnet: {
    PYTH_STATE_ID:
      "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
    PRICE_SERVICE_ENDPOINT: "https://hermes.pyth.network",
    WORMHOLE_STATE_ID:
      "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
    AGGREGATOR_OBJS: {
      "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI":
        {
          priceAggregator: {
            objectId:
              "0x795e888b88d2cfd5aa5174cba71418e87878c7dd7d1980e5b0b2e51cc499aa53",
            initialSharedVersion: 610893705,
            mutable: false,
          },
          pythPriceId:
            "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
        },
      "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC":
        {
          priceAggregator: {
            objectId:
              "0x4b612d4d2039d90f596a362f15346a95149728613ca9d2e2c7e471b72b86c105",
            initialSharedVersion: 610893707,
            mutable: false,
          },
          pythPriceId:
            "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
        },
    },
  },
  testnet: {
    PYTH_STATE_ID:
      "0x2d82612a354f0b7e52809fc2845642911c7190404620cec8688f68808f8800d8",
    PRICE_SERVICE_ENDPOINT: "https://hermes-beta.pyth.network",
    WORMHOLE_STATE_ID:
      "0xebba4cc4d614f7a7cdbe883acc76d1cc767922bc96778e7b68be0d15fce27c02",
    AGGREGATOR_OBJS: {
      "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC":
        {
          priceAggregator: {
            objectId:
              "0x50bfd18d36bf7a9a24c83d2a16e13eb88b824fd181e71e76acb649fae3143b8a",
            initialSharedVersion: "442159459",
            mutable: true,
          },
          // beta price id
          pythPriceId:
            "0x41f3625971ca2ed2263e78573fe5ce23e13d2558ed3f2e47ab0f84fb9e7ae722",
        },
    },
  },
};

export const COIN_SYMBOLS = ["USDC", "SUI"] as const;
export type COIN_SYMBOL = (typeof COIN_SYMBOLS)[number];
export const COIN_TYPES: Record<COIN_SYMBOL, string> = {
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
  SUI: "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI",
};
