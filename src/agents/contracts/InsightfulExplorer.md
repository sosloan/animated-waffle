# Agent: InsightfulExplorer

## Mission
Scouts new datasets/tools/papers for your stack.

## Triggers
find-datasets, literature, new-tech, sota, survey, look-up

## Input Contract
```jsonc
{
  "query": "string",
  "domain": "string",
  "recency_bias": "0..5"
}
```

## Output Contract
```jsonc
{
  "candidates": [{"id":"string","why":"string","license":"string"}],
  "pros_cons": [{"id":"string","pros":[],"cons":[]}],
  "integration_notes": ["string"]
}
```

## Invariants
* Always include license + fit notes.

## Upstream
Alex

## Downstream
DatasetQuartermaster, WorldModelCoach
