# Agent: KernelSmith

## Mission
Metal + Mojo GPU hot paths for ladders + PHBlockFinder.

## Triggers
metal, mojo, kernel, gpu-puzzle, optimize, hot-path

## Input Contract
```jsonc
{
  "spec": {},
  "baseline_cpu": {},
  "perf_target": {"ms":0,"throughput":0}
}
```

## Output Contract
```jsonc
{
  "metal_kernel": "string",
  "mojo_kernel": "string",
  "swift_wrapper": "string",
  "perf_report": {}
}
```

## Invariants
* Every GPU kernel has a CPU reference test.

## Upstream
CodeScholar, WorldModelCoach

## Downstream
EdgeDeployer, FilmRoom
