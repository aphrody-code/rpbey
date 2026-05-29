# Drizzle — doc vendorée (knowledge base refactor rpbey)

Doc complète Drizzle récupérée le **2026-05-26** pour le refactor monorepo `rpbey`.
Versions cibles : **drizzle-orm 0.45.2**, **drizzle-kit 0.31.10**.

## Fichiers

- `llms-full.txt` — doc complète (1,44 Mo / 49 416 lignes). **Ne pas lire en entier** : `grep`/`sed -n` ciblés.
- `llms.txt` — index officiel (246 lignes).

## Usage

```bash
grep -n "pgEnum" llms-full.txt              # localiser un concept
sed -n '1674,1720p' llms-full.txt           # lire une fenêtre précise
```

## Carte des sections clés pour CE refactor (n° de ligne `llms-full.txt`)

| Sujet                                                 | Ligne(s)         | Note refactor                                               |
| ----------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| Connexion **postgres-js** (`drizzle-orm/postgres-js`) | 6639             | driver retenu (bench gagnant, socket OK)                    |
| Connexion bun-sql (`drizzle-orm/bun-sql`)             | 5613             | **écarté** : Bun.SQL ne connecte pas en socket (testé KO)   |
| Référence types Postgres                              | 143–1700         | mapping colonnes                                            |
| `jsonb` + `.$type<>()`                                | 1387, 1703       | 15+ champs Json typés                                       |
| `enum` / `pgEnum(...)`                                | 53, 1674, 4271   | 12 enums — garder le nom de type Postgres EXACT de Prisma   |
| Identity columns                                      | 1720             | non utilisé (tout en cuid)                                  |
| Default value / `$defaultFn()`                        | 1747, 1779–1793  | `cuid()` → `$defaultFn(() => createId())`                   |
| `$onUpdate()` / `$onUpdateFn()`                       | 1797–1814        | `@updatedAt` → `$onUpdate` + trigger SQL                    |
| `relations(one/many)`                                 | 19793–19850      | relations applicatives                                      |
| **`relationName`** (désambiguïsation)                 | 29877, 32146     | **clé** : Part→Beyblade ×3, Part→DeckItem ×6, User→Match ×3 |
| `drizzle-kit generate`                                | 6515, 7092, 8915 | générer migrations                                          |
| `drizzle-kit pull` (introspection)                    | ~9000            | bootstrap depuis `rpb_neon`                                 |
| drizzle.config (`out`, dialect)                       | 9000+            | config kit                                                  |

## Rappels spécifiques rpbey (issus du fact-check + bench)

- **Colonnes en camelCase quotées** (`"createdAt"`, `"userId"`) — héritage Prisma (seules les _tables_ ont `@@map` snake_case). → **NE PAS** mettre `casing: "snake_case"` ; `drizzle-kit pull` reflète l'existant.
- Driver = **postgres.js sur unix socket** (`host=/var/run/postgresql`, peer auth `ubuntu`, `prepare: true`).
- Pas de perf à attendre vs Prisma 7 : Drizzle choisi pour contrôle SQL / Bun-natif / migrations légères.
