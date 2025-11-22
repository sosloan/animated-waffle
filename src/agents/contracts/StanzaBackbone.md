# Agent: StanzaBackbone

## Mission
Deterministic NLP featurization.

## Triggers
stanza, tokenize, ner, dep-parse, normalize-text

## Input Contract
```jsonc
{
  "text": "string",
  "config": {}
}
```

## Output Contract
```jsonc
{
  "tokens": [],
  "ner": [],
  "deps": [],
  "normalized_text": "string"
}
```

## Invariants
* Same text → same features.

## Upstream
DatasetQuartermaster

## Downstream
WorldModelCoach, CodeScholar
