module defi_concept::simple_coin {
    use sui::table::Table;

    // === Concept 0 ===
    public struct GlobalBalances {
        balances: Table<address, u64>,
    }

    public fun erc20_transfer(
        global_balances: &mut GlobalBalances,
        recipient: address,
        value: u64,
        ctx: &TxContext,
    ) {
        let sender = ctx.sender();

        assert!(global_balances.balances[sender] >= value);
        if (!global_balances.balances.contains(sender)) global_balances.balances.add(sender, 0);
        if (!global_balances.balances.contains(recipient))
            global_balances.balances.add(recipient, 0);

        *&mut global_balances.balances[sender] = global_balances.balances[sender] - value;
        *&mut global_balances.balances[recipient] = global_balances.balances[recipient] + value;
    }

    #[test]
    public fun test_global_balance_sheet() {
        use sui::table;
        let mut ctx = dummy_ctx(@0xA);
        let mut global_balances = GlobalBalances {
            balances: table::new(&mut ctx),
        };

        // topup
        global_balances.balances.add(@0xA, 100);

        // transfer actions; this all touch same shared object, require consensus
        {
            global_balances.erc20_transfer(@0xB, 50, &dummy_ctx(@0xA));
            global_balances.erc20_transfer(@0xA, 50, &dummy_ctx(@0xB));
        };

        std::unit_test::destroy(global_balances);
    }

    // Answer1: State should be split into objects with minimal overlap. By treating each object as the smallest possible unit of state, we allow Sui to optimize through parallel execution
    // === Concept 1 ===
    #[allow(unused_field)]
    public struct SimpleBalance has store {
        value: u64,
    }

    #[allow(unused_field)]
    public struct Supply {
        total_supply: u64,
    }

    #[allow(unused_field)]
    public struct Metadata {
        decimal: u8,
        icon_url: sui::url::Url,
    }

    // Answer2: Use a u64 value to track individual balances, and a total_supply field to track the aggregate state and enforce a supply cap
    #[allow(unused_field)]
    public struct CoinWithoutBalance {
        value: u64,
    }

    #[allow(unused_field)]
    public struct CoinWithBalance {
        balance: SimpleBalance,
    }

    public fun simlple_join(self: &mut SimpleBalance, balance: SimpleBalance): u64 {
        let SimpleBalance { value } = balance;
        self.value = self.value + value;
        self.value
    }

    /// Split a `Balance` and take a sub balance from it.
    public fun simple_split(self: &mut SimpleBalance, value: u64): SimpleBalance {
        assert!(self.value >= value);
        self.value = self.value - value;
        SimpleBalance { value }
    }

    public struct OddBalance {
        value: u64,
    }

    public fun split_odd(self: &mut OddBalance, value: u64): OddBalance {
        assert!(self.value >= value);
        self.value =
            if ((self.value - value) % 2 == 0) self.value - value - 1 else self.value - value;
        OddBalance { value }
    }

    // Answer_3:
    // 1. It improves readability and follows DRY (Don't Repeat Yourself) principles; Balance acts as a reusable type for various modules (e.g., Coin, Token).
    // 2. More importantly, it allows for encapsulated logic; since Move fields are private by default, we can strictly control how balances are modified through module functions.

    // === Concept 2 ===
    #[allow(unused_field)]
    public enum Owner has store {
        Owned(address),
        Shared(u64),
        Immutable,
    }

    #[allow(unused_field)]
    public struct OwnedCoin has key {
        id: UID,
        owner: Owner,
        balance: SimpleBalance,
    }

    // Answer_4:
    // Every object on Sui has a native owner field used by the protocol to validate ownership rules during transaction execution.
    public fun transfer(owned_coin: OwnedCoin, recipient: address) {
        // your logic here; ex: charge fee or whitelist transfer
        transfer::transfer(owned_coin, recipient);
    }

    // Answer_5: Using transfer (without the public prefix) allows you to define custom logic, such as restricted transfers or whitelists, because it can only be called within the module that defines the type

    // === Concept 3 ===
    // Answer_6: Without generics, we would have to redeploy the same logic for every new coin to prevent type collisions (e.g., CoinA vs CoinB). To avoid redundant deployments and simplify cross-coin compatibility, we leverage generic types

    public struct GenericTypeCoin has key {
        id: UID,
        coin_type: std::type_name::TypeName,
        balance: SimpleBalance,
    }

    public fun join(coin_a: &mut GenericTypeCoin, coin_b: GenericTypeCoin): u64 {
        let GenericTypeCoin { id, balance, coin_type } = coin_b;
        object::delete(id);

        // check type
        assert!(coin_type == coin_a.coin_type);

        coin_a.balance.simlple_join(balance);

        coin_a.balance.value
    }

    #[allow(unused_field, missing_phantom)]
    public struct Coin<CoinType> has key {
        id: UID,
        balance: sui::balance::Balance<CoinType>,
    }

    // Answer_7: An OTW is a specialized pattern where a struct is instantiated exactly once during module initialization, ensuring that the witness can uniquely and securely identify a specific type.

    public struct CoinCap<phantom T> has key {
        id: UID,
    }

    public fun new_with_normal_witness<T: drop>(_witness: T, ctx: &mut TxContext): CoinCap<T> {
        // we only check the object ownership eligibility
        CoinCap { id: object::new(ctx) }
    }

    public fun new_with_otw<T: drop>(witness: T, ctx: &mut TxContext): CoinCap<T> {
        // we check both object ownership eligibility & one-time guarantee
        assert!(sui::types::is_one_time_witness(&witness));
        CoinCap { id: object::new(ctx) }
    }

    // === Utils ===
    #[test_only]
    public fun dummy_ctx(sender: address): TxContext {
        let tx_hash = x"3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532";
        tx_context::new(sender, tx_hash, 0, 0, 0)
    }
}
