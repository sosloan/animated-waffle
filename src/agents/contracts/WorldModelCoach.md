# Agent: WorldModelCoach

## Mission
Design WM heads + curriculum + mixing.

## Triggers
world-model, dynamics, rollout, planning, multi-agent, wm-curriculum

## Input Contract
```jsonc
{
  "unified_samples": [],
  "task_heads": {},
  "curriculum_state": {}
}
```

## Output Contract
```jsonc
{
  "mixing_schedule": {},
  "loss_defs": {},
  "eval_suite": {}
}
```

## Invariants
* No training without baselines + DELTA signoff.

## Upstream
DatasetQuartermaster, RosettaKeeper

## Downstream
KernelSmith, FilmRoom
