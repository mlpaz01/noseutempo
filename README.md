# NoSeuTempo

Monorepo para manter o site, API e ferramentas do NoSeuTempo versionados no GitHub.

## Estrutura

- `apps/site`: site estático servido em `noseutempo.app`.
- `apps/api`: API Node servida em `api.noseutempo.app`.
- `apps/marketing-engine`: app de marketing separado, servido no VPS por PM2.
- `scripts`: automações locais e deploy para Hostinger.
- `docs`: fluxo de trabalho para desenvolvedores.

## Rodar local

No PowerShell:

```powershell
.\scripts\start-local.ps1
```

Depois abra:

```text
http://127.0.0.1:8088/login.html
```

O servidor local serve `apps/site` e faz proxy de `/api/*` para `https://api.noseutempo.app`.

## Fluxo diário

```powershell
git pull
.\scripts\start-local.ps1
```

Edite, teste localmente, depois:

```powershell
git status
git add .
git commit -m "Descreva a alteração"
git push
```

## Publicar na Hostinger

Depois de validar e commitar:

```powershell
git pull
.\scripts\deploy-hostinger.ps1 -Target site
```

Para publicar API:

```powershell
.\scripts\deploy-hostinger.ps1 -Target api
```

Para publicar tudo:

```powershell
.\scripts\deploy-hostinger.ps1 -Target all
```

O script faz backup remoto antes de sincronizar. Ele não guarda senha no repositório.

## Atualizar Hostinger com a última versão do GitHub

Depois que o repositório remoto estiver configurado:

```powershell
.\scripts\update-hostinger-from-github.ps1 -Target site
```

Ou tudo:

```powershell
.\scripts\update-hostinger-from-github.ps1 -Target all
```
