---
description: Review server hot-path code for performance issues against tick budget
---

Load the `perf-budget` skill and audit the code in context.

Steps:

1. Identify any allocations inside `setSimulationInterval` callbacks
2. Check for DB calls or async operations in the tick loop
3. Estimate per-tick CPU cost for any new entity scans or pathfinding calls
4. Verify `SpatialLookup` calls are appropriately throttled
5. Check broadcast frequency — are messages sent only on state change?
6. Flag any `Math.sqrt` or `JSON.parse/stringify` in hot paths

Report: ✅ within budget, ⚠️ marginal, ❌ over budget — with specific line references.
