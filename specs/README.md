# Specifications — skli

Product feature index. Each spec lives in `specs/features/<slug>.md`.

**Terminological authority:** [`domain-glossary.md`](features/domain-glossary.md) (`glossaryOwner`: `domain-glossary`).

## Feature template

Each `specs/features/<slug>.md` file follows this skeleton:

```markdown
# {Title}

| Field | Value |
|-------|--------|
| Slug | `{slug}` |
| Status | draft |
| Last review | {date} |

## Summary
## User flows
## Data model
## CLI
## Business rules
## User scenarios
## Dependencies
## Out of scope
## Acceptance criteria
## Terminology
## Implementation notes
```

### Conventions per section

| Section | Convention |
|---------|------------|
| **User flows** | Numbered journeys `Flow-01`, `Flow-02`, … — persona, preconditions, steps **command → expected result → errors**. |
| **Data model** | Tables for JSON files / persisted entities. Domain enums only in [`domain-glossary.md`](features/domain-glossary.md). |
| **CLI** | Signature `skli <command> [args] [options]` — arguments, options, exit codes. |
| **Business rules** | Numbered rules `BR-{slug}-NNN`. |
| **Status** | `draft` → `defined` → `defined+` (enriched) → `implemented`. |
| **Acceptance criteria** | Expected behavior; `[x]` if already in code, `[ ]` otherwise. |
| **Terminology** | Point to `domain-glossary`; do not redefine enums. |
