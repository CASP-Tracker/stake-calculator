/* Staking rates for the Stake Calculator for EU.
   Every figure was read from the exchange's own public EU page on `readOn`, then re-read by a second
   reviewer. Edit this file when a rate changes and bump `asOf`.

   Product fields
     min, max   published annual rate in percent (a single value repeats in both)
     kind       what the exchange calls it: "APR" or "APY"
     termDays   0 = flexible, otherwise the fixed term in days
     lock       optional text for the lock-up row when termDays is 0 (unbonding or redemption time)
     fee        commission in percent taken from the rewards, when the published rate is before it
     share      share of the stake that earns rewards (1 = all of it)
     compounds  false = simple interest, the reinvest switch does not apply
     promo      part of the figure is a limited-time promotion
     eu         "yes" | "unknown"  (rows not offered to EU clients are listed under `unavailable`)
*/
window.STAKING_DATA = {
  asOf: '2026-10-29',

  assets: [
    { symbol: 'ETH',  name: 'Ethereum',  color: '#627eea', defaultCoin: 5,     presets: [1, 5, 10, 50] },
    { symbol: 'BTC',  name: 'Bitcoin',   color: '#f7931a', defaultCoin: 0.25,  presets: [0.1, 0.25, 1, 5] },
    { symbol: 'USDC', name: 'USD Coin',  color: '#2775ca', defaultCoin: 10000, presets: [1000, 5000, 10000, 50000] },
    { symbol: 'LINK', name: 'Chainlink', color: '#2a5ada', defaultCoin: 500,   presets: [100, 500, 1000, 5000] },
    { symbol: 'POL',  name: 'POL',       color: '#8247e5', defaultCoin: 20000, presets: [5000, 20000, 50000, 100000] },
    { symbol: 'ATOM', name: 'Cosmos',    color: '#5b5f8a', defaultCoin: 1000,  presets: [100, 500, 1000, 5000] }
  ],

  exchanges: [
    {
      key: 'okx',
      name: 'OKX',
      logo: 'assets/logos/okx.png',
      entity: 'OKX Europe Limited',
      authorityShort: 'MFSA',
      country: 'Malta',
      licenceDate: '2025-01-27',
      verifyUrl: 'https://casptracker.eu/?q=okx.com#casp-list',
      regWarn: false,
      regNote: 'OKX calls these rewards variable estimates and not guaranteed. Smart-contract and slashing risk apply.',
      unavailable: {
        LINK: 'OKX Europe does not list LINK among its On-chain Earn products.'
      },
      products: {
        ETH: [
          { id: 'okx-eth', label: 'On-chain Earn: ETH staking (liquid, you receive BETH)', type: 'liquid', termDays: 0, min: 2.01, max: 2.01, kind: 'APY', eu: 'yes',
            minAmount: '0.001 ETH', note: 'Liquid staking: you receive BETH 1:1. Rewards are paid daily. OKX does not say whether a service fee is already inside the rate.',
            source: 'https://www.okx.com/en-eu/earn/ethereum-staking', readOn: '2026-10-29' }
        ],
        BTC: [
          { id: 'okx-btc', lock: 'Redemption takes about 7 days', label: 'On-chain Earn: Babylon BTC staking', type: 'onchain', termDays: 0, min: 0.5, max: 0.5, kind: 'APY', eu: 'yes',
            note: 'Listed as flexible, but OKX\'s May 2025 launch notice gives a 7-day redemption period and a per-user cap. A fee applies and is not stated.',
            source: 'https://www.okx.com/en-eu/earn/onchain-earn', readOn: '2026-10-29' }
        ],
        USDC: [
          { id: 'okx-usdc', label: 'On-chain Earn: USDC rewards (Spark, X Layer)', type: 'onchain', termDays: 0, min: 3.62, max: 3.62, kind: 'APY', eu: 'yes',
            note: 'These are DeFi rewards paid via Spark Protocol, not interest on USDC, and they are not guaranteed.',
            source: 'https://www.okx.com/en-eu/earn', readOn: '2026-10-29' }
        ],
        POL: [
          { id: 'okx-pol', label: 'On-chain Earn: POL staking', type: 'onchain', termDays: 0, min: 2.4, max: 2.4, kind: 'APY', eu: 'yes',
            note: 'Only the list row is public. Unbonding period, fee and minimum are shown after login.',
            source: 'https://www.okx.com/en-eu/earn/onchain-earn', readOn: '2026-10-29' }
        ],
        ATOM: [
          { id: 'okx-atom', label: 'On-chain Earn: Cosmos (ATOM) staking', type: 'onchain', termDays: 0, min: 18.81, max: 18.81, kind: 'APY', eu: 'yes',
            note: 'Far above the other rows and it can move quickly. Unbonding period, fee and minimum are shown after login.',
            source: 'https://www.okx.com/en-eu/earn', readOn: '2026-10-29' }
        ]
      }
    },

    {
      key: 'bybit',
      name: 'Bybit',
      logo: 'assets/logos/bybit.png',
      entity: 'Bybit EU GmbH',
      authorityShort: 'FMA',
      country: 'Austria',
      licenceDate: '2025-05-28',
      verifyUrl: 'https://casptracker.eu/?q=bybit.eu#casp-list',
      regNote: 'Bybit says Earn is not a MiCAR-regulated product: subscribing transfers ownership of your assets to Bybit EU GmbH and MiCAR client-asset protections do not apply.',
      unavailable: {},
      products: {
        ETH: [
          { id: 'bybit-eth-flex', label: 'Earn: flexible', type: 'flexible', termDays: 0, min: 0.8, max: 0.8, kind: 'APR', eu: 'yes', compounds: false, promo: true,
            note: 'Simple interest, paid daily and not compounded. Tagged "Limited Time Only" on the page.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-eth-30', label: 'Earn: fixed 30 days', type: 'fixed', termDays: 30, min: 1.0, max: 1.0, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Simple interest on the fixed term. No early redemption.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ],
        BTC: [
          { id: 'bybit-btc-flex', label: 'Earn: flexible', type: 'flexible', termDays: 0, min: 1.2, max: 1.2, kind: 'APR', eu: 'yes', compounds: false, promo: true,
            note: 'Simple interest, paid daily and not compounded. Tagged "Limited Time Only" on the page.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-btc-10', label: 'Earn: fixed 10 days', type: 'fixed', termDays: 10, min: 0.3, max: 0.3, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Simple interest on the fixed term. No early redemption.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-btc-30', label: 'Earn: fixed 30 days', type: 'fixed', termDays: 30, min: 0.5, max: 0.5, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Simple interest on the fixed term. No early redemption.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-btc-180', label: 'Earn: fixed 180 days', type: 'fixed', termDays: 180, min: 0.8, max: 0.8, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Simple interest on the fixed term. No early redemption.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ],
        USDC: [
          { id: 'bybit-usdc-flex', label: 'Earn: flexible', type: 'flexible', termDays: 0, min: 1.02, max: 1.02, kind: 'APR', eu: 'yes', compounds: false, promo: true,
            note: 'Simple interest, paid daily and not compounded. Tagged "Limited Time Only" on the page.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-usdc-10', label: 'Earn: fixed 10 days', type: 'fixed', termDays: 10, min: 3.0, max: 3.0, kind: 'APR', eu: 'yes', compounds: false, promo: true,
            note: 'Simple interest on the fixed term. Tagged "Limited Time Only" on the page.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-usdc-30', label: 'Earn: fixed 30 days', type: 'fixed', termDays: 30, min: 5.0, max: 5.0, kind: 'APR', eu: 'yes', compounds: false, promo: true,
            note: 'Simple interest on the fixed term. Tagged "Limited Time Only" on the page.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ],
        LINK: [
          { id: 'bybit-link-10', label: 'Earn: fixed 10 days', type: 'fixed', termDays: 10, min: 1.0, max: 1.0, kind: 'APR', eu: 'yes', compounds: false,
            note: 'No flexible LINK product is listed. Simple interest on the fixed term.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' },
          { id: 'bybit-link-30', label: 'Earn: fixed 30 days', type: 'fixed', termDays: 30, min: 1.2, max: 1.2, kind: 'APR', eu: 'yes', compounds: false,
            note: 'No flexible LINK product is listed. Simple interest on the fixed term.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ],
        POL: [
          { id: 'bybit-pol-flex', label: 'Earn: flexible', type: 'flexible', termDays: 0, min: 0.8, max: 0.8, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Floating rate, simple interest, paid daily and not compounded.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ],
        ATOM: [
          { id: 'bybit-atom-flex', label: 'Earn: flexible', type: 'flexible', termDays: 0, min: 0.8, max: 0.8, kind: 'APR', eu: 'yes', compounds: false,
            note: 'Floating rate, simple interest, paid daily and not compounded.',
            source: 'https://www.bybit.eu/en-EU/earn/home/', readOn: '2026-10-29' }
        ]
      }
    },

    {
      key: 'kraken',
      name: 'Kraken',
      logo: 'assets/logos/kraken.png',
      entity: 'Payward Europe Solutions Limited',
      authorityShort: 'CBI',
      country: 'Ireland',
      licenceDate: '2025-06-25',
      verifyUrl: 'https://casptracker.eu/?q=kraken.com#casp-list',
      regNote: 'Kraken\'s EEA terms say staking is provided by Payward Commercial Ltd. (British Virgin Islands) and is not a regulated activity in the EEA. Kraken\'s MiCA licence page does not list staking among the licensed services.',
      unavailable: {
        LINK: 'Kraken offers no LINK staking to clients in the EEA.',
        USDC: 'Kraken says Opt-In Rewards in the EEA are available for Bitcoin only, so USDC rewards are not offered to EEA clients.'
      },
      products: {
        ETH: [
          { id: 'kraken-eth-bonded', lock: 'Bonded, about 6 days to unbond', label: 'Bonded on-chain staking', type: 'onchain', termDays: 0, min: 2.81, max: 2.81, kind: 'APY', eu: 'yes', fee: 25,
            note: 'Published rate is an estimate before commission (25% up to USD 1M of bonded assets). About 6 days to unbond, weekly payouts. ETH has no flexible option.',
            source: 'https://www.kraken.com/features/staking/ethereum', readOn: '2026-10-29' }
        ],
        BTC: [
          { id: 'kraken-btc-flex', label: 'Opt-In Rewards: flexible (Kraken Pro)', type: 'flexible', termDays: 0, min: 0.1, max: 0.1, kind: 'APY', eu: 'yes',
            note: 'Kraken Pro only, capped at 175 BTC in total, no fee currently. Bitcoin is the only Opt-In asset open to EEA clients.',
            source: 'https://support.kraken.com/articles/360044886311-overview-of-opt-in-rewards-on-kraken', readOn: '2026-10-29' }
        ],
        POL: [
          { id: 'kraken-pol-bonded', lock: 'Bonded, about 3 days to unbond', label: 'Bonded on-chain staking', type: 'onchain', termDays: 0, min: 8.44, max: 8.44, kind: 'APY', eu: 'yes', fee: 25,
            note: 'Published rate is an estimate before commission (25% up to USD 1M of bonded assets). About 3 days to unbond, weekly payouts.',
            source: 'https://www.kraken.com/features/staking/polygon-ecosystem-token', readOn: '2026-10-29' },
          { id: 'kraken-pol-flex', label: 'Flexible staking', type: 'flexible', termDays: 0, min: 4.13, max: 4.13, kind: 'APY', eu: 'yes', fee: 30, share: 0.5,
            note: 'Published rate is before a flat 30% commission, and rewards are earned on at most 50% of the stake. Weekly payouts.',
            source: 'https://www.kraken.com/features/staking/polygon-ecosystem-token', readOn: '2026-10-29' }
        ],
        ATOM: [
          { id: 'kraken-atom-bonded', lock: 'Bonded, about 21 days to unbond', label: 'Bonded on-chain staking', type: 'onchain', termDays: 0, min: 24.62, max: 24.62, kind: 'APY', eu: 'yes', fee: 25,
            note: 'Published rate is an estimate before commission (25% up to USD 1M of bonded assets). About 21 days to unbond, weekly payouts. Rate can move quickly.',
            source: 'https://www.kraken.com/features/staking/cosmos', readOn: '2026-10-29' },
          { id: 'kraken-atom-flex', label: 'Flexible staking', type: 'flexible', termDays: 0, min: 11.64, max: 11.64, kind: 'APY', eu: 'yes', fee: 30, share: 0.5,
            note: 'Published rate is before a flat 30% commission, and rewards are earned on at most 50% of the stake. Weekly payouts.',
            source: 'https://www.kraken.com/features/staking/cosmos', readOn: '2026-10-29' }
        ]
      }
    }
  ]
};
