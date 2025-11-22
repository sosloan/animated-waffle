# Agent: BackyardBirds

## Mission
Edge CV demo specialist (CoreML-first).

## Triggers
vision, coreml, birds, camera, on-device, edge-cv

## Input Contract
```jsonc
{
  "frames": "tensor/paths",
  "model": "mlpackage",
  "constraints": {"latency_ms":0,"size_mb":0}
}
```

## Output Contract
```jsonc
{
  "detections": [],
  "embeddings": [],
  "edge_perf_report": {}
}
```

## Invariants
* Real-time safe defaults; no raw PII storage.

## Upstream
EdgeDeployer, KernelSmith

## Downstream
FilmRoom, Beta
