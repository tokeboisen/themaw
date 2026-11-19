# Plan: server og webapp til The Maw

Planen beskriver, hvordan The Maw bygges som server og webapp efter Event Modellen i `ProductOwner/`. Spillet kører i Docker Desktop på denne maskine, og andre spillere på det lokale netværk spiller i deres browser. Det er ikke på internettet.

## 1. Rammer

- **Modellen er specifikationen.** De 40 features i `ProductOwner/contexts/*/features/` beskriver, hvad der skal bygges, og kun det. Mangler der noget, ændres modellen først, derefter koden (CLAUDE.md, Feature → kode).
- **Sporbarhed.** Kode og tests nævner featurens nummer og element-ID'er (f.eks. `F019 CMD-01`). Hvert Gherkin-scenarie giver mindst én test.
- **Prototypen** i `prototype/` er reference for gameplay og balance. Dens regler (`js/core`) og tests bliver grundlaget for den fælles regelpakke.
- **Webapp først.** Telefon og touch venter (Feature-027).

## 2. Arkitektur

Seks containere i én Docker Compose-stak (projektnavn `maw`):

| Container | Rolle | Bounded contexts | Port |
|---|---|---|---|
| `gateway` (Caddy 2) | Én adresse for spillerne: `/` → webappen, `/api` → api, `/ws` → tithe-server | – | `0.0.0.0:8100` på lokalnettet |
| `web` | Webappen som statiske filer (bygget i containeren) | – (viser alle views) | kun internt |
| `api` | Commands via REST og forespørgsler. Moduler pr. context, der kun taler sammen via events | Accounts, Characters, Gear, Market, Patronage, Lobby, Other players (Parties) | kun internt |
| `tithe-server` | Kører hver Tithe i hukommelsen, 30 gange i sekundet, og taler med browserne over WebSocket | Tithe, Spectacle, partierne i en Tithe (Parties) | kun internt |
| `rabbitmq` (4, management) | Events mellem contexts | – | management på `127.0.0.1:15673` |
| `postgres` (17) | Ét skema pr. context; data i et Docker-volume | – | ikke udstillet (`127.0.0.1:5433` ved fejlsøgning) |

Portene er valgt, så de ikke rammer de andre stakke på maskinen: EventModelling bruger 80, Running Coach bruger 8080, 5432 og 15672, og prototypen bruger 5180.

**Model og processer:** Maw Server er ét IT-system i modellen, men to processer i drift, fordi de opfører sig forskelligt. `api` svarer på forespørgsler og bruger databasen. `tithe-server` er en spil-løkke i realtid.

## 3. Lokalt netværk

- **Adresse for spillerne:** `http://toke-thinkpad-t14s-gen-3.local:8100`, som mDNS via Avahi slår op. Den virker på Linux, Mac og iPhone og som regel på Windows 10+. Alternativt `http://192.168.68.70:8100`, men IP'en kommer fra DHCP over wifi og kan skifte. Lav en fast reservation i routeren, hvis navnet ikke virker for alle.
- **Firewall:** ufw er slået til. Du skal selv åbne porten for lokalnettet (kræver sudo):

  ```bash
  sudo ufw allow from 192.168.68.0/22 to any port 8100 proto tcp
  ```

- **Kun gatewayen er udstillet.** RabbitMQ og Postgres lytter kun på 127.0.0.1 eller internt i Docker. Åbn ikke porten i routeren; spillet er kun til lokalnettet.
- **HTTP uden TLS** er fint på lokalnettet. Sessions-cookien er `HttpOnly` og `SameSite=Lax`, men ikke `Secure`. WebSocket går over `ws://`. Spillet bruger ingen browser-API'er, der kræver HTTPS.
- **Maskinen skal være vågen** og Docker Desktop startet, mens der spilles. Stakken får `restart: unless-stopped`.

## 4. Teknologi

- **TypeScript på Node 22 i alle dele**, så spillets regler findes ét sted og deles af `api`, `tithe-server` og `web`.
- **`api`:** Fastify, `pg`, `amqplib`, `argon2` til password-hash og `zod` til validering af commands.
- **`tithe-server`:** `ws` og `amqplib`.
- **`web`:** TypeScript og Canvas, videreført fra prototypens klient og bygget med esbuild.
- **Byggeriet sker i Docker** (multi-stage), så `node_modules` og Postgres-data ikke lander i OneDrive-mappen. Postgres bruger et Docker-volume, ikke en mappe i OneDrive.
- **`HungerGamesDungeonCrawler/` bliver sit eget git-repo** med modellen, prototypen og koden.

```
HungerGamesDungeonCrawler/
  ProductOwner/            Event Modellen (kilden)
  prototype/               den første web-prototype (reference)
  packages/rules/          spillets regler og balance (fra prototype/js/core), med tests
  packages/contracts/      events, commands og WebSocket-beskeder som typer
  apps/api/                REST-API, moduler pr. context, outbox og consumers
  apps/tithe-server/       spil-løkken og WebSocket
  apps/web/                webappen
  deploy/                  docker-compose.yml, Caddyfile, .env.example
  docs/                    arkitektur og event-katalog
```

## 5. Fra model til kode

| I modellen | I koden |
|---|---|
| Command fra et UI View i Rim, lobby eller menuer | REST-endpoint i `api`. Afvisninger svarer med featurens UI-tekst, f.eks. `{"message": "Not enough gold."}` |
| Command fra et UI View i en Tithe (Strike, Dodge, Draw weapon, Invite player …) | Besked over WebSocket til `tithe-server` |
| Aggregate | Tabeller i konteksts skema og det modul, der håndhæver dets regler |
| Event, der bliver i sin context | Håndteres i processen |
| Event, der er stimulus i en anden context | Besked på RabbitMQ via outbox |
| Application Service | Consumer på konteksts kø, eller en del af spil-løkken i `tithe-server` |
| UI View | Skærm i webappen; data via `GET` eller push over WebSocket |
| Regler og Gherkin-scenarier | Tests, navngivet med feature og ID |

**Karakteren under en Tithe.** Når en Tithe startes, får `tithe-server` en arbejdskopi af hver deltagers karakter: egenskaber, skills, Echo, inventar, hotbar og guld. Følgende udføres i spil-løkken med reglerne fra `packages/rules`:
- Learn by use (F002), Earn Marks (F003) og Spend points (F004)
- Pick up loot (F006), Manage equipment (F007), Use consumables (F008)
- Assign hotbar keys (F027) og Use the hotbar (F028)

Resultatet sendes med "Tithe ended" og gemmes af Characters og Gear. Mens karakteren er i en lobby eller en Tithe, afviser `api` commands, der ændrer den: Forge, Apothecary, Delete character og Choose character. Det følger modellens regler.

## 6. Events over RabbitMQ

- **Exchange:** `maw.events` (topic). Routing key `<context>.<event>`, f.eks. `tithe.tithe-ended`.
- **Køer:** én holdbar kø pr. context, der lytter: `maw.characters`, `maw.gear`, `maw.market`, `maw.patronage` og `maw.tithe`. Beskeder, der fejler gentagne gange, havner i en dead-letter-kø.
- **Konvolut:** `{ id, type, occurredAt, data }`. Hver service har en outbox-tabel, og hver consumer husker behandlede ID'er, så samme event aldrig tæller to gange.

| Event (feature) | Udgiver | Lyttere (feature) |
|---|---|---|
| Character created (F001) | api · Characters | Gear F005, Market F018 og F021 |
| Character deleted (F038) | api · Characters | Gear F005, Market F018 og F021, Patronage F023, Characters F039 |
| Item bought, Item sold (F019) | api · Market | Gear F005 |
| Potion bought, Ration bought (F020) | api · Market | Gear F005 |
| Item gift accepted (F024) | api · Patronage | Gear F005 |
| Gold gift accepted (F024), Purse paid (F022) | api · Patronage | Market F018 |
| Found gear kept (F009) | api · Gear | Market F018 |
| Tithe launched (F037) | api · Lobby | tithe-server F010 |
| Tithe ended (F016) | tithe-server | Gear F009, Market F021, Patronage F022 og F023, Characters F039. Med beskeden følger arbejdskopien, så Characters og Gear også gemmer skills, Echo, Marks og inventar fra Tithen |
| Player defeated (F011) | tithe-server | Market F018, Characters F039 |

To fortolkninger af modellen:
- **Renown earned (F017)** bliver inde i `tithe-server`, fordi den sker mange gange i sekundet. Summen sendes med "Tithe ended", som Patronage F022 og F023 bruger. Det svarer til modellens regel om, at kassereren lægger Renown sammen og betaler, når Tithen slutter.
- **Guld på gulvet (F011, F018).** `tithe-server` kender spillerens guld fra arbejdskopien. Den lægger 10–20 % på gulvet med det samme og sender beløbet med "Player defeated". Market trækker det samme beløb.

Én teknisk event uden for modellen: `tithe.player-progress` hvert 30. sekund. Den gemmer skills, Echo og Marks undervejs, så de aldrig går tabt (F016), heller ikke hvis serveren går ned.

## 7. API

Kun til commands og forespørgsler uden for en Tithe. Login giver en sessions-cookie.

| Context | Endpoints (feature) |
|---|---|
| Accounts | `POST /api/users` (F031), `POST /api/sessions` (F032), `DELETE /api/sessions` (F033), `GET /api/me` |
| Characters | `GET /api/backgrounds` (F001), `GET`/`POST /api/characters` (F026, F001), `POST /api/characters/{id}/choose` (F026), `DELETE /api/characters/{id}` (F038), `POST …/attribute-points` og `…/skill-points` (F004), `GET …/statistics` (F040) |
| Gear | `GET …/inventory`, `POST …/equip` og `…/unequip` (F007), `PUT`/`DELETE …/hotbar/{key}` (F027) |
| Market | `GET /api/forge`, `POST /api/forge/buy` og `/sell` (F019), `POST /api/apothecary/buy` (F020), `GET /api/wallet` |
| Patronage | `GET /api/gifts`, `POST /api/gifts/{id}/accept` (F024) |
| Lobby | `GET /api/tithes`, `POST /api/tithes` (F036), `POST /api/tithes/{name}/join` (F025), `…/launch` og `…/leave` (F037) |
| Other players | `GET /api/players` (F034) |

I første omgang henter Rim og lobby nye data hvert andet sekund. Push kommer senere, hvis det trænger.

## 8. WebSocket i en Tithe

- **Adgang:** Når Tithen startes, får hver spiller en engangsbillet fra lobbyen. Webappen forbinder til `/ws?ticket=…`.
- **Fra browseren:** input op til 30 gange i sekundet (bevægelse, angreb, dodge, potion, ration, interact, hotbar-tast). Dertil handlingerne equip, drop, hotbar og point (F004, F007, F027), invite, accept, decline og leave party (F034, F035) samt leave Tithe (F029).
- **Fra serveren:** et snapshot 20 gange i sekundet, kun med det, spilleren kan se (synsradius 7). Det forhindrer, at nogen kan snyde sig til kortet. Partimedlemmer kommer med på minimappet med brugernavn. Mirrormasterens beskeder, tal, der stiger op, og nedtællingen til invitationer kommer også herfra.
- **Mistet forbindelse:** Spilleren kan komme tilbage inden for 60 sekunder. Derefter tæller det som at forlade Tithen (F029).
- **Ingen forudsigelse i klienten** til at starte med. Forsinkelsen på et lokalnet er lav, så webappen tegner bare snapshots med lidt udjævning.

## 9. Faser

Hver fase slutter med noget, der kan spilles eller prøves fra en anden maskine på netværket.

| Fase | Indhold | Features |
|---|---|---|
| **0. Fundament** (bygget 2026-11-19; mangler ufw-reglen og en prøve fra en anden enhed) | Git-repo; npm workspaces; Docker Compose med de seks containere og health checks; port 8100 åbnet og prøvet fra en anden enhed; `packages/rules` overført fra prototypen med dens tests; outbox og consumer med en test fra udgivelse til modtagelse. To afvigelser: selve Tithen (`prototype/js/core/world.js`) flyttes først i fase 3, hvor den skrives om til flere spillere; og bussen ligger i en tredje pakke, `packages/platform`, som både `api` og `tithe-server` bruger | – |
| **1. Bruger og karakterer** | Sign in, Characters, Create character med point, grænser, styrker og svagheder, karakterskærmen som overlay, Delete | F031–F033, F001, F026, F038, F004 |
| **2. The Rim** | Inventar, startudstyr, Forge, Apothecary, tegnebog, sponsorgaver, hotbar, statistikvisning | F005, F007, F018–F021, F024, F027, F040 |
| **3. Lobby og Tithe for én spiller** | Åbn, join og start en Tithe; serveren kører hele Tithen med NPC-rivaler, Mirrormaster, loot, sult, hotbar, Help og Leave; resultatet afgøres, og pengepung, gaver, smedjens lager og statistik følger | F036, F025, F037, F010–F017, F002, F003, F006, F008, F009, F022, F023, F028–F030, F039 |
| **4. Flere spillere** | Op til 8 spillere i samme Tithe, hver i sit eget rum, brugernavne, PvP mellem partier, partier i de første 20 sekunder, Other players-overlay, partiet på minimappet, hele partiet som Champion, guld på gulvet og Player kills, genforbindelse inden for 60 sekunder; playtest med venner på netværket | F011, F015, F018, F029, F034, F035, F039 |
| **5. Drift** | Backup af Postgres (`pg_dump`), logs, en belastningstest med 8 bot-spillere, README om start, stop og hvordan man joiner | – |

## 10. Test

- **`packages/rules`:** prototypens 13 tests flyttes med og udvides.
- **Features:** hvert Gherkin-scenarie bliver en test, navngivet med feature og ID. `api` testes over HTTP mod Postgres og RabbitMQ i Docker. `tithe-server` testes med bot-klienter over WebSocket.
- **Event-kataloget:** en test læser modellernes stimuli i `ProductOwner/` og tjekker, at hvert event, der krydser contexts, har en udgiver og en lytter i `packages/contracts`. Modellen og koden kan så ikke glide fra hinanden.
- **Belastning:** 8 bot-spillere i én Tithe skal holde 30 opdateringer i sekundet på denne maskine.

## 11. Risici

- **Realtid på serveren** kræver en fast takt og små snapshots. Det løses i `tithe-server` med kun det synlige og 20 snapshots i sekundet.
- **OneDrive:** Byggeri og data holdes i Docker, og `.gitignore` udelukker `node_modules`, `dist` og `.env`.
- **Wifi og IP:** Bruger man mDNS-navnet, betyder det intet, at IP'en skifter.
- **Docker Desktop har 7,4 GB hukommelse** og deler den med Running Coach-stakken. Det rækker til The Maw med 8 spillere; det kontrolleres i fase 5.
- **Hemmeligheder** (Postgres- og RabbitMQ-passwords) ligger i `deploy/.env`, som ikke kommer i git, efter `deploy/.env.example`.

## 12. Valg, der skal bekræftes

1. TypeScript/Node i `api`, `tithe-server` og `web`.
2. Port 8100 og adressen `http://toke-thinkpad-t14s-gen-3.local:8100`.
3. `HungerGamesDungeonCrawler/` som eget git-repo.
4. Prototypen bliver liggende som reference.
