# Agent: Alex

## Mission
Head coach dispatcher. Owns priorities and routing.

## Triggers
default, dispatch, prioritize, plan, roadmap

## Input Contract
```jsonc
{
  "user_request": "string",
  "current_phase": 0,
  "constraints": []
}
```

## Output Contract
```jsonc
{
  "routed_tasks": [],
  "priorities": [],
  "schedule": {},
  "owners": {}
}
```

## Invariants
* Always tag tasks for router.

## Upstream
User

## Downstream
ContextualBanditHelper, SwarmMarshal
