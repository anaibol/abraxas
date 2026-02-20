---
description: Design or review a combat ability — formulas, balance, TTK, resources
---

Load the `combat-design` skill and apply it to the ability or mechanic in context.

Steps:

1. Verify the ability object has all required fields (id, effect, baseDamage, scalingStat, scalingRatio, rangeTiles, windupMs, cooldownMs, costs)
2. Estimate damage output at level 1, 10, 20 using the formula reference
3. Check TTK impact against targets
4. Verify resource costs match the class's resource system
5. Confirm `effect` type is handled in `CombatSystem.applyAbilityToTarget()`
6. Check the new ability checklist (i18n keys, asset references, class assignment)

Report balance assessment and any missing checklist items.
