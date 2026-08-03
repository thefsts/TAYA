# seedClient Re-Run Verification

This document proves that `seedClient:seedReviews` safely upserts the
`reviewSources` record on every run — including the common workflow of
seeding with a pending Place ID first, then updating it with the real one.

## Relevant code path

`convex/seedClient.ts` — `seedReviews` handler:

```
1. Query reviewSources by_site for this siteId
2. Build sourceData = { provider, config.placeId, config.businessName, ... }
3. if (existingSource):
     ctx.db.patch(existingSource._id, sourceData)   ← always overwrites
     sourceId = existingSource._id
   else:
     sourceId = ctx.db.insert("reviewSources", sourceData)
4. Delete all importedReviews for this siteId (idempotent)
5. Re-insert sampleReviews from config with new sourceId
```

## Two-run scenario

### Run 1 — pending Place ID (at onboarding time)

Config snippet:
```json
"reviews": {
  "provider": "google",
  "placeId": "PENDING_acme-gym",
  "businessName": "Acme Gym",
  ...
}
```

Result:
- `reviewSources` record inserted with `config.placeId = "PENDING_acme-gym"`
- 2 seed reviews inserted

### Run 2 — real Place ID (after Google Business is verified)

Config snippet:
```json
"reviews": {
  "provider": "google",
  "placeId": "ChIJrTLr-GyuEmsRBfy61i59si0",
  "businessName": "Acme Gym",
  ...
}
```

Result:
- `reviewSources` record **patched** (same `_id`) with `config.placeId = "ChIJrTLr-GyuEmsRBfy61i59si0"`
- Old seed reviews deleted; new ones inserted with correct `sourceId`
- **No stale record** with the pending placeholder remains

### Provider-change scenario

If a client switches from `"google"` to `"yelp"`:

- The same patch path fires: `provider` field is overwritten on the existing
  source record
- All imported reviews are deleted and re-inserted under the new provider
- No data inconsistency between source provider and review provider fields

## Why the old seedCorsair.ts didn't need this

`seedCorsair.ts` is a one-shot seeder for a single known site — it was never
intended to be re-run with updated configs. `seedClient.ts` is the reusable
tool that must be idempotent across all 13 steps, including this one.
