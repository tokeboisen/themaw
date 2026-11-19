# The Maw

En top-down dungeon crawler, hvor skills vokser ved brug. Spillet kører i Docker Desktop på denne maskine, og andre spillere på det lokale netværk spiller i deres browser.

- `ProductOwner/`: Event Modellen. Den er specifikationen; koden bygges efter dens features.
- `Plan-server-og-webapp.md`: planen for server og webapp i faser.
- `prototype/`: den første web-prototype, bevaret som reference for gameplay og balance.

## Start og stop

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

```bash
docker compose -f deploy/docker-compose.yml down
```

Første gang: kopiér `deploy/.env.example` til `deploy/.env` og sæt passwords. Filen kommer ikke i git.

## Spil på netværket

Andre spillere åbner `http://toke-thinkpad-t14s-gen-3.local:8100`, eller `http://192.168.68.70:8100`, hvis navnet ikke virker. IP'en kommer fra DHCP over wifi og kan skifte.

Firewallen (ufw) skal tillade port 8100 fra lokalnettet. Det kræver sudo og gøres én gang:

```bash
sudo ufw allow from 192.168.68.0/22 to any port 8100 proto tcp
```

Kun gatewayen kan nås udefra. RabbitMQ's management-UI er på `http://127.0.0.1:15673` og kun på denne maskine (brugeren `maw`, passwordet står i `deploy/.env`).

## Udvikling

OneDrive synkroniserer mappen, så `node_modules` ligger i et Docker-volume og ikke her. Installation, typetjek og tests kører i `tools`-containeren:

```bash
docker compose -f deploy/docker-compose.yml run --rm tools npm install
```

```bash
docker compose -f deploy/docker-compose.yml run --rm tools npm run typecheck
```

```bash
docker compose -f deploy/docker-compose.yml run --rm tools npm test
```

Integrationstesten af bussen kræver, at `postgres` og `rabbitmq` kører. `packages/rules` har ingen afhængigheder, så dens tests kan også køres direkte med Node 22: `node --test packages/rules/test/*.test.ts`.

Node 22 kører TypeScript direkte (type stripping). Derfor har `api` og `tithe-server` intet byggetrin; kun webappen bygges med esbuild.

```
packages/rules/        spillets regler og balance (fra prototypen), delt af alle
packages/contracts/    events og event-kataloget; testen holder kataloget i trit med modellen
packages/platform/     bussen over RabbitMQ
apps/api/              REST-API, Postgres, outbox og migrationer
apps/tithe-server/     Tithes i hukommelsen og WebSocket
apps/web/              webappen
deploy/                Dockerfile, docker-compose.yml, Caddyfile og .env
```

## Sporbarhed

Kode og tests nævner featurens nummer og element-ID'er, f.eks. `F019 CMD-01`, og hvert Gherkin-scenarie bliver mindst én test. Ændres adfærd, ændres modellen i `ProductOwner/` først.
