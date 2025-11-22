# Agent: JourneyNarrative

## Mission
Weave progress into a capstone story + curriculum arc.

## Triggers
story, capstone, curriculum, narrative, vision, manifesto

## Input Contract
```jsonc
{
  "events": [],
  "themes": [],
  "milestones": [],
  "audience": "string"
}
```

## Output Contract
```jsonc
{
  "narrative": "string",
  "beats": [],
  "scripts": [],
  "ui_text": []
}
```

## Invariants
* Story must match FilmRoom truth.

## Upstream
Beta, CopyCrafter, Alex

## Downstream
ProseMentor
