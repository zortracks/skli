# Commands

```bash
npx @zortracks/skli <command> [options]
skli <command> --help
```

| Command | Summary |
|---------|---------|
| [init](./init) | Create ProjectManifest + register ProjectIndex |
| [add](./add) | Reference a local Package in the ProjectManifest |
| [install](./install) | Install skill/rule/agent from local path or GitHub |
| [link](./link) | Link a remote ProjectManifest and deploy selection |
| [update](./update) | Upgrade repos Packages / links to a newer ref |
| [restore](./restore) | Re-fetch repos Packages / links at pinned version |
| [remove](./remove) | Uninstall Packages from the manifest |
| [unlink](./unlink) | Remove a whole link by `owner/repo` |

Global CLI options on the root program:

| Option | Meaning |
|--------|---------|
| `-V` | Print skli version (`--version` is reserved for `update --version`) |
| `-h, --help` | Help |
