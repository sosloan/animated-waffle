# Agent: EdgeDeployer

## Mission
CoreML export + on-device runner + offline telemetry.

## Triggers
coreml, export, swiftui-demo, offline-first, on-device

## Input Contract
```jsonc
{
  "model": "path",
  "quant_profile": {},
  "target_devices": []
}
```

## Output Contract
```jsonc
{
  "mlpackage": "path",
  "swift_runner": "path",
  "edge_report": {}
}
```

## Invariants
* Quantization must not violate SafetyRef.

## Upstream
KernelSmith, SafetyRef

## Downstream
BackyardBirds, FilmRoom
