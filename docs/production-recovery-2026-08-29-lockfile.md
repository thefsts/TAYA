# TAYA Production Recovery — 2026-08-29

This commit records the recovery from three Vercel deployment failures caused by the temporary `artifacts/taya-marketing` workspace being added without a synchronized root `pnpm-lock.yaml`.

Recovery state:

- `main` was restored to commit `b9590fbf13b34d58862d90f0cca944a644524d01`, the last known green production state before the standalone marketing workspace was introduced.
- The TAYA system/dashboard remains isolated from the separate TAYA marketing website work.
- Node remains 24.x.
- Frozen-lockfile installs remain enabled; they are not bypassed.

This marker intentionally triggers a fresh production deployment from the corrected system branch so Vercel can verify the current TAYA dashboard build is green.
