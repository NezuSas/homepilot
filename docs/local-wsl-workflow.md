# Windows-to-WSL Appliance Workflow

## Purpose

Use Windows as the development workstation and the Linux appliance as the
runtime target. The Git repository is the transfer boundary: validate locally,
push a reviewed commit, pull it on the appliance, then deploy through the
maintenance script.

## Windows Development

```bash
npm run verify:quality
git status
git add <files>
git commit -m "<concise message>"
git push origin main
```

Do not copy source files or SQLite databases manually between operating systems.

## Linux Appliance

```bash
cd ~/homepilot
git pull --ff-only
bash scripts/homepilot-maintenance.sh --deploy --yes
bash scripts/homepilot-maintenance.sh --status
```

## Health Checks

```bash
docker compose ps
docker compose logs --tail=150 homepilot-api
curl -fsS http://127.0.0.1:3000/health
```

## Safety

- Stop if `git pull --ff-only` reports local changes; resolve them before
  deployment.
- Do not use reset, destructive cleanup, or database deletion as a deployment
  shortcut.
- The appliance database is local runtime state, not a source-controlled asset.