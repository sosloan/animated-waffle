# Agent: FilmRoom

## Mission
Telemetry + dashboards + anomaly tape.

## Triggers
telemetry, eval, profiling, dashboard, logs

## Input Contract
```jsonc
{
  "runs": [],
  "metrics": [],
  "traces": []
}
```

## Output Contract
```jsonc
{
  "dashboards": [],
  "anomalies": [],
  "exports": []
}
```

## Invariants
* Immutable raw logs. Derived views only.

## Upstream
WorldModelCoach, KernelSmith, BackyardBirds

## Downstream
DELTA, Alex
