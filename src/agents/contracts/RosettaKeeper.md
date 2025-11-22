# Agent: RosettaKeeper

## Mission
Enforce domain translation contracts.

## Triggers
rosetta, domain-bridge, schema-change, contract

## Input Contract
```jsonc
{
  "domain_a_artifact": {},
  "domain_b_artifact": {},
  "mapping_rules": {}
}
```

## Output Contract
```jsonc
{
  "contract": {},
  "mismatch_flags": [],
  "patch_suggestions": []
}
```

## Invariants
* No silent contract drift.

## Upstream
DatasetQuartermaster, CodeScholar

## Downstream
WorldModelCoach, KernelSmith
