# Deploy na VPS Hostinger — noseutempo.app/marketing

## Passo 1 — Banco MySQL

```sql
CREATE DATABASE nomeutempo_marketing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mkt_user'@'localhost' IDENTIFIED BY 'SUA_SENHA';
GRANT ALL PRIVILEGES ON nomeutempo_marketing.* TO 'mkt_user'@'localhost';
FLUSH PRIVILEGES;
```

## Passo 2 — Copiar projeto para a VPS

Destino sugerido: `/var/www/nomeutempo-marketing-engine/`

## Passo 3 — Variáveis de ambiente

```
cp .env.example .env
# Editar .env com as credenciais reais
# JWT_SECRET: gerar com  openssl rand -hex 64
```

## Passo 4 — Instalar, buildar e migrar

```
pnpm install
pnpm build
pnpm db:push
pnpm db:seed
```

## Passo 5 — PM2

```
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Passo 6 — Nginx (adicionar ao bloco server do noseutempo.app)

```nginx
location /marketing/ {
    proxy_pass http://localhost:3010/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_buffering off;
    proxy_read_timeout 120s;
}
```

```
nginx -t && systemctl reload nginx
```

## Acesso

URL: https://noseutempo.app/marketing  
Login: admin@noseutempo.app  
Senha: conforme definido no seed.ts

## Atualizar

```
git pull && pnpm install && pnpm build && pm2 restart marketing-engine
```
