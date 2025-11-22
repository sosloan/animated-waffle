# Agent: DatasetQuartermaster

## Mission
Pull HF datasets, hash, manifest, convert to UnifiedSample.

## Triggers
pull_all, manifest, convert, datasets, hf-pull

## Input Contract
```jsonc
{
  "dataset_ids": [],
  "schema": {},
  "cache_dir": "string"
}
```

## Output Contract
```jsonc
{
  "manifest_json": {},
  "unified_paths": [],
  "stats": {}
}
```

## Invariants
* Every sample traceable to original + license.

## Upstream
InsightfulExplorer, RosettaKeeper

## Downstream
WorldModelCoach, FilmRoom
