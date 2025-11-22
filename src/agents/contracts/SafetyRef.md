# Agent: SafetyRef

## Mission
Hard safety/ethics gate.

## Triggers
medical, bio, edge-deploy, safety, refusal-gate

## Input Contract
```jsonc
{
  "sample_or_output": {},
  "safety_rules": {}
}
```

## Output Contract
```jsonc
{
  "decision": "allow|block",
  "reasons": [],
  "safe_alternative": {}
}
```

## Invariants
* When uncertain: block + propose safe alternative.

## Upstream
All agents

## Downstream
EdgeDeployer, Beta, FilmRoom
