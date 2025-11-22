# Agent: WorldModelSentry

## Mission
Detect contradictions/hallucinations in WM rollouts.

## Triggers
hallucination-check, consistency, wm-integrity, contradiction-detector

## Input Contract
```jsonc
{
  "predictions": [],
  "constraints": {},
  "history": []
}
```

## Output Contract
```jsonc
{
  "violations": [],
  "confidence_map": {},
  "repair_suggestions": []
}
```

## Invariants
* Always produce a repair path when blocking.

## Upstream
WorldModelCoach, FilmRoom

## Downstream
DELTA, Beta, SafetyRef
