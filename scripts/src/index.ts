import {
  Account,
  deepbook,
  DeepBookClient,
  mainnetPythConfigs,
  SuiPriceServiceConnection,
  SuiPythClient,
  mainnetPackageIds,
  mainnetCoins,
  type BalanceManager,
  type MarginManager,
} from "@mysten/deepbook-v3";
import type { ClientWithExtensions, SuiClientTypes } from "@mysten/sui/client";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  Transaction,
  type TransactionArgument,
} from "@mysten/sui/transactions";
import dotenv from "dotenv";
import { logger } from "./logger";
import { CONFIG } from "./const";
import { normalizeStructTag } from "@mysten/sui/utils";
import type { NetworkConfig } from "./type";
import { bcs } from "@mysten/sui/bcs";
dotenv.config();

// Signer
const secret = process.env.SUI_PRIVATE_KEY! as string;
const { secretKey } = decodeSuiPrivateKey(secret);
export const signer = Ed25519Keypair.fromSecretKey(secretKey);

// Client
// Pools info
//https://github.com/MystenLabs/ts-sdks/blob/6000f4e96da2712ff235e64a229661b034953fc6/packages/deepbook-v3/src/utils/constants.ts#L8

class DeepBookMarketMaker {
  client: ClientWithExtensions<{ deepbook: DeepBookClient }>;
  keypair: Ed25519Keypair;
  env: "testnet" | "mainnet";
  config: NetworkConfig;
  balanceManagers: Record<string, BalanceManager>;
  marginManagers: Record<string, MarginManager>;
  // pyth
  pythClient: SuiPythClient;
  pythConnection: SuiPriceServiceConnection;

  constructor(
    privateKey: string,
    env: "testnet" | "mainnet",
    balanceManagers: Record<string, BalanceManager>,
    marginManagers: Record<string, MarginManager> = {},
  ) {
    this.env = env;
    this.keypair = this.getSignerFromPK(privateKey);
    this.balanceManagers = balanceManagers;
    this.marginManagers = marginManagers;
    this.client = this.#createClient(env, balanceManagers, marginManagers);
    this.config = CONFIG[this.env];
    this.pythConnection = new SuiPriceServiceConnection(
      this.config.PRICE_SERVICE_ENDPOINT,
    );
    this.pythClient = new SuiPythClient(
      this.client,
      mainnetPythConfigs.pythStateId,
      mainnetPythConfigs.wormholeStateId,
    );
  }

  #createClient(
    env: "testnet" | "mainnet",
    balanceManagers: Record<string, BalanceManager>,
    marginManagers: Record<string, MarginManager>,
  ) {
    return new SuiGrpcClient({
      network: env,
      baseUrl:
        env === "mainnet"
          ? "https://fullnode.mainnet.sui.io:443"
          : "https://fullnode.testnet.sui.io:443",
    }).$extend(
      deepbook({
        address: this.getActiveAddress(),
        balanceManagers,
        marginManagers,
      }),
    );
  }

  getSignerFromPK = (privateKey: string): Ed25519Keypair => {
    const { scheme, secretKey } = decodeSuiPrivateKey(privateKey);
    if (scheme === "ED25519") return Ed25519Keypair.fromSecretKey(secretKey);

    throw new Error(`Unsupported scheme: ${scheme}`);
  };

  getActiveAddress() {
    return this.keypair.toSuiAddress();
  }

  getAggregatorObjectInfo({ coinType }: { coinType: string }) {
    const t = normalizeStructTag(coinType);
    const aggregatorInfo = CONFIG[this.env].AGGREGATOR_OBJS[t as any];

    if (!aggregatorInfo) {
      throw new Error("Unsupported coin type");
    }
    return aggregatorInfo;
  }

  async aggregateBasicPrices(tx: Transaction, coinTypes: string[]) {
    if (!coinTypes.length) {
      return [];
    }
    const pythPriceIds = coinTypes.map((coinType) => {
      const aggregator = this.getAggregatorObjectInfo({ coinType });

      if (!("pythPriceId" in aggregator)) {
        throw new Error(`${coinType} has no basic price`);
      }
      return aggregator.pythPriceId;
    });
    const updateData =
      await this.pythConnection.getPriceFeedsUpdateData(pythPriceIds);
    const priceInfoObjIds = await this.pythClient.updatePriceFeeds(
      tx,
      updateData,
      pythPriceIds,
    );

    return priceInfoObjIds;
  }

  async simulateTransaction(
    tx: Transaction,
    include?: SuiClientTypes.TransactionInclude,
    execute = false,
  ) {
    tx.setSender(this.getActiveAddress());
    const res = await this.client.core.simulateTransaction({
      transaction: tx,
      include: {
        ...include,
        effects: true,
      },
    });

    if (res.Transaction?.effects.status.success) {
      logger.info("transaction success");

      if (execute) {
        const res = await this.signAndExecuteTransaction(tx, {
          ...include,
          effects: true,
        });
        logger.info(
          `Execute Transaction Successfully: ${res.Transaction?.digest}`,
        );

        return res;
      }
    } else {
      logger.error("transaction fails");
      tx.getData().commands.forEach((c, idx) => logger.debug({ [idx]: c }));
    }

    return null;
  }

  async signAndExecuteTransaction(
    tx: Transaction,
    include?: SuiClientTypes.TransactionInclude,
  ) {
    return this.client.core.signAndExecuteTransaction({
      transaction: tx,
      signer: this.keypair,
      include,
    });
  }

  async checkBalanceManagerInfo() {
    return await Promise.all(
      Object.keys(this.marginManagers).map((m) =>
        this.client.deepbook.getMarginManagerBaseBalance(m),
      ),
    );
  }
  // Transaction
  async createMarginManager(tx: Transaction, poolKey: string) {
    // initialize
    const { manager, initializer } =
      this.client.deepbook.marginManager.newMarginManagerWithInitializer(
        poolKey,
      )(tx);

    // add referral
    tx.moveCall({
      target: `${mainnetPackageIds.MARGIN_PACKAGE_ID}::margin_manager::set_margin_manager_referral`,
      arguments: [
        manager,
        tx.object(
          "0xf29fcdf2957836bd175a24d202d51a11eeb404c61cb4edbe6cc308ec532cfd97",
        ),
      ],
      typeArguments: [mainnetCoins.SUI.type, mainnetCoins.USDC.type],
    });

    // settle
    this.client.deepbook.marginManager.shareMarginManager(
      poolKey,
      manager,
      initializer,
    )(tx);
  }

  marginManagerDepositBase(
    tx: Transaction,
    managerKey: string,
    amount: number,
  ) {
    tx.add(
      this.client.deepbook.marginManager.depositBase({
        managerKey,
        amount,
      }),
    );
  }

  marginManagerDepositQuote(
    tx: Transaction,
    managerKey: string,
    amount:
      | { amount: number; coin?: never }
      | { amount?: never; coin: TransactionArgument },
  ) {
    tx.add(
      this.client.deepbook.marginManager.depositQuote({
        managerKey,
        ...amount,
      }),
    );
  }

  marginManagerBorrowBase(tx: Transaction, managerKey: string, amount: number) {
    tx.add(this.client.deepbook.marginManager.borrowBase(managerKey, amount));
  }

  marginManagerBorrowQuote(
    tx: Transaction,
    managerKey: string,
    amount: number,
  ) {
    tx.add(this.client.deepbook.marginManager.borrowQuote(managerKey, amount));
  }

  marginManagerWithdrawBase(
    tx: Transaction,
    managerKey: string,
    amount: number,
  ) {
    return tx.add(
      this.client.deepbook.marginManager.withdrawBase(managerKey, amount),
    );
  }

  marginManagerWithdrawQuote(
    tx: Transaction,
    managerKey: string,
    amount: number,
  ) {
    return tx.add(
      this.client.deepbook.marginManager.withdrawQuote(managerKey, amount),
    );
  }

  marginManagerPlaceMarketOrder(
    tx: Transaction,
    managerKey: string,
    quantity: number,
  ) {
    tx.add(
      this.client.deepbook.poolProxy.placeMarketOrder({
        poolKey: "SUI_DBUSDC",
        marginManagerKey: "MANAGER_1",
        clientOrderId: "123456789",
        quantity,
        isBid: true,
      }),
    );
  }

  marginManagerPlaceLimitOrder(
    tx: Transaction,
    managerKey: string,
    price: number,
    isBid: boolean,
    quantity: number,
    tickSize: number,
  ) {
    tx.add(
      this.client.deepbook.poolProxy.placeLimitOrder({
        poolKey: "SUI_DBUSDC",
        marginManagerKey: "MANAGER_1",
        clientOrderId: "123456789",
        price,
        quantity,
        isBid,
        tickSize,
      }),
    );
  }

  marginManagerCancelOrder(
    tx: Transaction,
    managerKey: string,
    orders: string[],
  ) {
    tx.add(this.client.deepbook.poolProxy.cancelOrders(managerKey, orders));
  }

  async getBalanceManagerOpenOrders(managerKey: string) {
    const manager = this.balanceManagers?.[managerKey];
    if (!manager) throw new Error("Invalid managerKey");

    const SUI_USDC_ACCOUNT_TABLE_ID =
      "0x85b985f2546b2d0138fe4fec0c9407e955a456c1e081cce71608fee67fcdde01";
    const result = await this.client.core.getDynamicField({
      parentId: SUI_USDC_ACCOUNT_TABLE_ID,
      name: {
        type: "0x2::object::ID",
        bcs: bcs.Address.serialize(manager.address).toBytes(),
      },
    });

    const account = Account.parse(result.dynamicField.value.bcs);
    const openOrders = account.open_orders;
    return this.client.deepbook.getOrders("SUI_USDC", openOrders.contents);
    //   order:
    //    {
    //      balance_manager_id: '0xa28d019ba63d4b58f4c0819665d98b921c81ebce3b1
    // eeec04466aa55f02f255e',
    //      order_id: '170141183460491367824575755177969832142',
    //      client_order_id: '12710855276398252170',
    //      quantity: '1000000000',
    //      filled_quantity: '0',
    //      fee_is_deep: false,
    //      order_deep_price:
    //       {
    //         asset_is_base: false,
    //         deep_per_asset: '0'
    //       },
    //      epoch: '1028',
    //      status: 0,
    //      expire_timestamp: '18446744073709551615'
    //    }
    // }
    // 2026.02.04 07:02:25 INFO {
    //   order:
    //    {
    //      balance_manager_id: '0xa28d019ba63d4b58f4c0819665d98b921c81ebce3b1
    // eeec04466aa55f02f255e',
    //      order_id: '18446762520453625184501197',
    //      client_order_id: '12710855276398252170',
    //      quantity: '1000000000',
    //      filled_quantity: '0',
    //      fee_is_deep: false,
    //      order_deep_price:
    //       {
    //         asset_is_base: false,
    //         deep_per_asset: '0'
    //       },
    //      epoch: '1028',
    //      status: 0,
    //      expire_timestamp: '18446744073709551615'
    //    }
  }
}

async function main() {
  const balanceManagers: Record<string, BalanceManager> = {
    primary: {
      address:
        "0xa28d019ba63d4b58f4c0819665d98b921c81ebce3b1eeec04466aa55f02f255e",
      tradeCap:
        "0xd95881bea68bce3e1e8cc30439e7762096b85b14f244add756e9c61a4dc49cf3",
    },
    secondary: {
      address:
        "0xf5b5994e5ffda42e8b58de5890ff6f2a7275804e3231a9f679aaa6c1bf0e67ec",
      tradeCap:
        "0x02d5ace13a9b9604bbecf3a7078559f376946e44fdbafa53b6dfd08709af93e3",
    },
  };
  const marginManagers: Record<string, MarginManager> = {
    primary: {
      address:
        "0x76521d778043649102f73c0acf20c0898bef7758c9e0e01a0324dc06f58e25e2",
      poolKey: "SUI_USDC",
    },
    secondary: {
      address:
        "0x2bc52a92490cea10f09bc4baa29f92b1baa78badae10d594488bfcdbec9059d1",
      poolKey: "SUI_USDC",
    },
  };
  const marketMaker = new DeepBookMarketMaker(
    secret,
    "mainnet",
    balanceManagers,
    marginManagers,
  );

  const assets =
    await marketMaker.client.deepbook.getMarginManagerAssets("primary");
  logger.info({ assets });
  const debts =
    await marketMaker.client.deepbook.getMarginManagerState("primary");
  logger.info({ debts });
  const midPrice = await marketMaker.client.deepbook.midPrice("SUI_USDC");
  logger.info({ midPrice });
  const poolId = await marketMaker.client.deepbook.poolId("SUI_USDC");
  logger.info({ poolId });

  const openOrders = await marketMaker.getBalanceManagerOpenOrders("primary");
  openOrders?.forEach((order) => logger.info({ order }));
}

main().catch(console.error);
