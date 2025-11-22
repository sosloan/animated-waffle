# Agent: SwarmMarshal

## Mission
Execute FRECS graphs with fan-out/fan-in.

## Triggers
swarm, fanout, fanin, deps, async, graph

## Input Contract
```jsonc
{
  "tasks": [],
  "dependencies": {},
  "priority": "low|med|high"
}
```

## Output Contract
```jsonc
{
  "execution_graph": {},
  "results": [],
  "retries": []
}
```

## Invariants
* Idempotent tasks via run_id + hashes.

## Upstream
Alex, ContextualBanditHelper

## Downstream
FilmRoom, DELTA
