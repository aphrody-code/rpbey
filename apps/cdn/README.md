
> ⚠️ **INFRASTRUCTURE GÉRÉE PAR ANTIGRAVITY (GOD MODE)**
> Ce projet opère sous la **Directive Omega**. L'architecture, les dépendances, et le code sont gérés et refactorisés de manière 100% autonome. Aucune sécurité conservative n'est appliquée. La performance brute est l'unique métrique.
\n# cdn — `cdn.rosegriffon.fr`

Serveur d'images Bun minimal qui remplace l'ancien `api.alessf.fr` (down).
Drop-in compatible : même contrat REST, mêmes headers, même format de réponse.

## Architecture

```
clients (achillea-bot, …)              navigateurs / hotlinks
       │                                       │
       ▼                                       ▼
  POST /upload  ┐                     ┌── GET /<id>.<ext>
  DELETE /:id  ─┼──► nginx (TLS) ─────┤   (static, immutable 1y)
  GET /health  ─┘    HTTP/3 + CORS    │
                          │           │
                          ▼           ▼
                  Bun.serve   /var/www/cdn/images/
                  127.0.0.1:8804      (servi directement par nginx)
```

- **Writes** (upload/delete) → proxied vers Bun.
- **Reads** → servis directement par nginx (`try_files`), Bun n'est jamais touché.

## API

Toutes les routes write requièrent le header `x-api-key: <CDN_API_KEY>`.

### `POST /upload`

```bash
curl -X POST https://cdn.rosegriffon.fr/upload \
  -H "Content-Type: image/png" \
  -H "x-api-key: $CDN_API_KEY" \
  --data-binary @photo.png
# → {"id":"7b457c771af35d27.png","url":"https://cdn.rosegriffon.fr/7b457c771af35d27.png"}
```

Contraintes :
- `Content-Type` ∈ `image/{png,jpeg,webp,gif,svg+xml}`
- Body ≤ 25 MB (sinon 413)
- Body non vide (sinon 400)
- L'`id` retourné est `<16 hex chars>.<ext>`, à conserver pour DELETE

### `DELETE /images/:id`

```bash
curl -X DELETE https://cdn.rosegriffon.fr/images/7b457c771af35d27.png \
  -H "x-api-key: $CDN_API_KEY"
# → {"success":true}      ou {"success":false} si l'id n'existe plus
```

### `GET /:id.ext`

Public, cache `max-age=31536000, immutable`, CORS `*`.

```bash
curl -O https://cdn.rosegriffon.fr/7b457c771af35d27.png
```

### `GET /health`

```bash
curl https://cdn.rosegriffon.fr/health
# → {"ok":true,"storage":"/var/www/cdn/images"}
```

## Déploiement

```bash
# Bootstrap (une fois)
sudo mkdir -p /var/www/cdn/images
sudo chown ubuntu:www-data /var/www/cdn/images && sudo chmod 775 /var/www/cdn/images
echo "CDN_API_KEY=$(openssl rand -hex 32)" > /home/ubuntu/vps/apps/cdn/.env
chmod 600 /home/ubuntu/vps/apps/cdn/.env

# Cert SSL
sudo certbot certonly --nginx -d cdn.rosegriffon.fr

# Vhost nginx
sudo cp /home/ubuntu/vps/infra/nginx/cdn.rosegriffon.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx

# systemd
sudo cp /home/ubuntu/vps/infra/systemd/cdn.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cdn.service
```

## Variables d'environnement

| Var | Défaut | Description |
|---|---|---|
| `CDN_API_KEY` | (requis) | API key pour POST /upload + DELETE — 32+ chars |
| `CDN_PORT` | `8804` | Port d'écoute Bun |
| `CDN_HOST` | `127.0.0.1` | Bind interface |
| `CDN_STORAGE` | `/var/www/cdn/images` | Dir absolue de stockage |
| `CDN_PUBLIC_BASE` | `https://cdn.rosegriffon.fr` | Base URL retournée dans la réponse upload |

## Ops

```bash
sudo systemctl status cdn         # status
sudo systemctl restart cdn        # restart (pickup .env)
journalctl -u cdn -f              # logs live
sudo systemctl reload nginx       # après modif vhost
ls -la /var/www/cdn/images/       # liste fichiers
```

## Compatibilité

Le contrat est identique à l'ancien `api.alessf.fr` :
- Format de réponse upload : `{id, url}` (mêmes clés)
- Format DELETE : `{success: bool}`
- URL publique : pattern `<base>/<id>` (id contient déjà l'extension)

→ pas de patch côté clients (achillea-bot `CustomImagesUpload.ts`,
`api/controllers/proxy.ts`), seuls `IMAGE_SERVER_URL` et `IMAGE_SERVER_API_KEY`
changent dans leur `.env`.
