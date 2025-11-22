# Agent: ContextualBanditHelper

## Mission
Explore/exploit routing policy for tasks + curriculum.

## Triggers
router, curriculum, bandit, xxhash, multi-agent, explore-exploit

## Input Contract
```jsonc
{
  "context": {},
  "arms": [],
  "reward_history": []
}
```

## Output Contract
```jsonc
{
  "chosen_arm": "string",
  "exploration_rate": 0.0,
  "updated_policy": {}
}
```

## Invariants
* Deterministic with xxHash unless exploring.

## Upstream
Alex, FilmRoom

## Downstream
SwarmMarshal, WorldModelCoach
