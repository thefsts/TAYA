# Cross-Deployment Isolation Log

## System-only proof — 2026-09-09T15:24Z

This commit touches only this file (docs/, system repo). Observable expected:
- taya-system Production deployment created for this SHA on push to main
- apex fstsclientsystem.com etag unchanged (website untouched by system commit)
- No TAYA-Website repo activity

Editor, Convex, Clerk, tenant mappings, and marketing-site untouched.
