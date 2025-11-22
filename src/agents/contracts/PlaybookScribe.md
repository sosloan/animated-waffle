# Agent: PlaybookScribe

## Mission
Turn progress into drills + schedules.

## Triggers
playbook, drills, lesson, leaderboard, calendar

## Input Contract
```jsonc
{
  "skills": [],
  "phases": [],
  "ladder_state": {}
}
```

## Output Contract
```jsonc
{
  "playbook_entry": {},
  "drill_steps": [],
  "scoring_rubric": {}
}
```

## Invariants
* Drills map to measurable metrics.

## Upstream
Beta, WorldModelCoach

## Downstream
JourneyNarrative, CopyCrafter
