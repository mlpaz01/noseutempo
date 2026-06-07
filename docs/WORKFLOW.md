# Workflow de Desenvolvimento

## Regra de ouro

Toda alteração deve passar por:

1. `git pull`
2. edição local
3. teste em `http://127.0.0.1:8088`
4. `git commit`
5. `git push`
6. deploy pela script `scripts/deploy-hostinger.ps1`

Assim Codex, Claude Code e outros devs trabalham sobre a mesma base.

## Configuração inicial de um dev

```powershell
git clone <URL_DO_REPOSITORIO_GITHUB> noseutempo-dev
cd noseutempo-dev
.\scripts\start-local.ps1
```

Se for mexer na API localmente, copie:

```powershell
copy apps\api\.env.example apps\api\.env
```

Preencha as chaves reais apenas no `.env` local ou no servidor. Nunca commite `.env`.

## Deploy

Site:

```powershell
.\scripts\deploy-hostinger.ps1 -Target site
```

API:

```powershell
.\scripts\deploy-hostinger.ps1 -Target api
```

Tudo:

```powershell
.\scripts\deploy-hostinger.ps1 -Target all
```

Para garantir que a Hostinger receba exatamente a última versão do GitHub:

```powershell
.\scripts\update-hostinger-from-github.ps1 -Target site
```

## Caminhos de produção no VPS

- Site: `/home/user_1/htdocs/noseutempo.app`
- API: `/home/noseutempo-api/htdocs/api.noseutempo.app`
- Marketing engine: `/var/www/nomeutempo-marketing-engine`

## Dados que não entram no GitHub

- `.env`
- `apps/api/data/*.json`
- gravações, caches de TTS, backups e logs
- `node_modules`
- builds gerados

Esses dados ficam no servidor ou no ambiente local de cada dev.
