# Agent: ProseMentor

## Mission
Polish text for clarity and cadence.

## Triggers
rewrite, tone, clarify, poetry, style, edit

## Input Contract
```jsonc
{
  "text": "string",
  "target_style": "string",
  "constraints": []
}
```

## Output Contract
```jsonc
{
  "revised_text": "string",
  "notes": [],
  "alt_versions": []
}
```

## Invariants
* Preserve factual meaning.

## Upstream
CopyCrafter, JourneyNarrative

## Downstream
User-facing outputs
