# API Docs (Incremental)

## Distributor Order Snapshot Display

When feature flag `catalogLinking` is enabled and an order is placed by a distributor (or its sub-user):

Stored snapshot fields (USD):
- distributorCapitalUsdAtOrder
- distributorSellUsdAtOrder
- distributorProfitUsdAtOrder
- fxUsdToDistAtOrder (USD -> distributor currency snapshot)
- distCurrencyCodeAtOrder

List endpoint `/api/tenant/distributor/orders/list` returns (for distributor role):
```json
{
  "items": [
    {
      "id": "order-uuid",
      "capitalUSD": "8.000",
      "sellUSD": "14.000",
      "profitUSD": "6.000",
      "currency": "SAR",
      "capitalDist3": "30.000",
      "sellDist3": "52.500",
      "profitDist3": "22.500"
    }
  ]
}
```
`capitalDist3/sellDist3/profitDist3` are derived strictly from frozen snapshots using `fxUsdToDistAtOrder`, ensuring stability even if current FX rates or distributor preferred currency change later.

Tenant owner view (with optional `?distributorId=` filter) returns USD snapshot formatting only (no Dist3):
```json
{
  "items": [ { "capitalUSD": "8.000", "sellUSD": "14.000", "profitUSD": "6.000" } ]
}
```

## Profit Report
`/api/tenant/distributor/orders/reports/profit`:
- Distributor: `{ "totalProfitUSD": "6.000", "currency": "SAR", "totalProfitDist3": "22.500" }`
- Owner: `{ "totalProfitUSD": "6.000" }`

## Notes
- Legacy orders created before FX snapshot migration fall back to live FX if `fxUsdToDistAtOrder` is NULL.
- All numeric string fields are formatted with 3 decimals.
