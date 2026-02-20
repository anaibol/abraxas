---
description: Review a feature or PR for netcode correctness — authority model, bandwidth, cheat surfaces
---

Load the `netcode-review` skill and apply its full checklist to the code currently in context.

Steps:

1. Check every `room.onMessage` handler against the authority model checklist
2. Verify broadcast vs. sendToClient decisions for each message type
3. Estimate payload sizes for new broadcast messages
4. Scan for common cheat surfaces (position trust, damage trust, cooldown bypass)
5. Verify all new `ClientMessageType` / `ServerMessageType` entries exist in `@abraxas/shared`

Report findings as a structured list: ✅ passes, ❌ issues, ⚠️ warnings.
