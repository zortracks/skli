# Project schema

Published JSON Schema for the ProjectManifest:

- In-repo: [`schemas/skli.project.schema.json`](https://github.com/zortracks/skli/blob/main/schemas/skli.project.schema.json)
- Raw URL (for `$schema` references):

```
https://raw.githubusercontent.com/zortracks/skli/main/schemas/skli.project.schema.json
```

Example at the top of `.skli/skli.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/zortracks/skli/main/schemas/skli.project.schema.json",
  "name": "my-project",
  "versioning": "tag",
  "skills": {},
  "rules": {},
  "agents": {}
}
```

GlobalManifest and ProjectIndex schemas are not published separately in v0.
