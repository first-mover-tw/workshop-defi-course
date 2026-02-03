module defi_concept::course {
    use sui::table::Table;

    // === Concept 0: Account-Based vs. Object-Centric ===
    // Q1. What is the Account-based model?
    // What are the performance advantages and disadvantages compared to Sui?
    #[allow(unused_field)]
    public struct GlobalBalances {
        balances: Table<address, u64>,
    }

    // === Concept 1: State Design ===
    // Q2. What fields do we need in a 'Balance' struct for fungible tokens?
    // Q3. What is the architectural difference between using a 'Balance' struct
    // vs. putting a raw 'u64' value directly inside a 'Coin' object?
    #[allow(unused_field)]
    public struct Balance { /* TODO: Q2 */ }

    #[allow(unused_field)]
    public struct CoinWithoutBalance { /* TODO: Q3 */ }

    #[allow(unused_field)]
    public struct CoinWithBalance { /* TODO: Q3 */ }

    // === Concept 2: Ownership Rules ===
    // Q4. How do you implement a transfer using Sui's native transfer functions?
    // Q5. What is the difference between 'public_transfer' and 'transfer'?
    public fun transfer() {}

    public fun public_transfer() {}

    // === Concept 3: Generic Types ===
    // Q6. If we define a 'Coin' struct without generics (like below),
    // what problems do we face regarding scalability and arbitrage?
    #[allow(unused_field)]
    public struct SimpleCoin has key {
        id: UID,
        value: u64,
    }

    // === Concept 4: One-Time-Witness (OTW) ===
    // Q7. What is a One-Time-Witness?
    // Q8. Why must it have the 'drop' ability? Can it have other abilities?
    public struct COURSE has drop {}
}
