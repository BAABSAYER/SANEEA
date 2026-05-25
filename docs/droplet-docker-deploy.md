# Saneea Droplet Docker Deployment

## 1. Prepare the droplet

Install Docker and the Compose plugin on the DigitalOcean droplet, then clone the repo:

```bash
git clone https://github.com/BAABSAYER/SANEEA.git
cd SANEEA
```

## 2. Create production environment file

Copy the template and fill real production values:

```bash
cp .env.production.example .env.production
nano .env.production
```

Keep `.env.production` on the server only. Do not commit it.

Required values:

```env
DATABASE_URL=...
SESSION_SECRET=...
JWT_SECRET=...
OTP_PROVIDER=authentica
AUTHENTICA_API_KEY=...
AWS_REGION=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
WHATSAPP_PROVIDER=ultramsg
ULTRAMSG_BASE_URL=...
ULTRAMSG_INSTANCE=...
ULTRAMSG_TOKEN=...
ERP_PROVIDER=hal
HAL_BASE_URL=...
HAL_API_KEY=...
HAL_EXTERNAL_TENANT_ID=...
```

## 3. Start the stack

```bash
docker compose up -d --build
docker compose logs -f saneea-web
```

This single command starts PostgreSQL, runs `npm run db:push` once, then starts the web app.

The app listens on container port `5000` and is published on host port `18087`:

```text
http://YOUR_DROPLET_IP:18087
```

If you also keep a local `.env` file in the repo and Docker Compose warns about `$` inside secrets, run Compose with the default `.env` loader disabled:

```bash
COMPOSE_DISABLE_ENV_FILE=1 docker compose up -d --build
```

For local Docker on Windows/macOS, a database URL that uses `localhost` points back into the container. If PostgreSQL is running on your host machine, use:

```env
DATABASE_URL=postgresql://USER:PASSWORD@host.docker.internal:5432/DATABASE
```

If login returns `password authentication failed`, the container reached PostgreSQL successfully, but the username/password in `.env.production` are not accepted by that database.

## 4. Put HTTPS in front of the container

Point your domain DNS `A` record to the droplet IP, then use a reverse proxy such as Nginx or Caddy to proxy:

```text
https://your-domain.com -> http://127.0.0.1:18087
```

The mobile app must use the HTTPS domain, not the raw `http://IP:5000` URL, for store builds.

## 5. Run database migrations manually if needed

Migrations run automatically during `docker compose up -d --build` through the `saneea-migrate` service. To run them manually:

```bash
docker compose run --rm saneea-migrate
```

## 6. Build mobile apps for the droplet URL

From your local machine:

```bash
cd saneea_mobile_react

# Replace with the HTTPS domain that points to the droplet.
$env:EXPO_PUBLIC_API_URL="https://your-domain.com"
npx eas-cli build -p android --profile production --clear-cache
npx eas-cli build -p ios --profile production --clear-cache
```

For WSL/Linux/macOS:

```bash
cd saneea_mobile_react
EXPO_PUBLIC_API_URL=https://your-domain.com npx eas-cli build -p android --profile production --clear-cache
EXPO_PUBLIC_API_URL=https://your-domain.com npx eas-cli build -p ios --profile production --clear-cache
```

The same URL is also used for the in-app privacy policy link:

```text
https://your-domain.com/privacy-policy
```
