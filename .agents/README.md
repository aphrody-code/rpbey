# `.agents/` — couche de coordination multi-agents

Permet à **plusieurs sub-agents de travailler en parallèle sur la même branche
(`main`) sans collision de fichier**. La garantie « zéro collision » est
**structurelle** : chaque _lane_ (agent) possède un ensemble de chemins
**disjoint** des autres (`agents.json` → `lanes[].owns` moins `excludes`).

| Fichier | Rôle |
| --- | --- |
| `../agents.json` | manifeste : lanes, ownership disjoint, protocole mailbox, gates, policy |
| `../task.md` | tableau de bord : phases, tâches par domaine (cases à cocher), burndown |
| `verify-ownership.ts` | **garde-fou** — asserte disjonction + couverture totale de la dette |
| `mailbox/<lane>.inbox.jsonl` | messages reçus par la lane (JSONL append-only) |
| `mailbox/<lane>.outbox.jsonl` | messages émis par la lane (miroir) |
| `mailbox/_broadcast.jsonl` | annonces `to: "*"` lues par toutes les lanes au démarrage |

## Lancer la vérification (toujours avant de spawn / après édition de `agents.json`)

```bash
bun .agents/verify-ownership.ts
# ✓ DISJONCTION — aucun fichier possédé par 2 lanes.
# ✓ COUVERTURE — les N fichiers de dette sont tous possédés.
```

Exit ≠ 0 = collision (2 lanes possèdent le même fichier) **ou** trou (un fichier
de dette n'est possédé par personne). Corriger les globs avant de spawn.

## Envoyer un message (depuis une lane ou l'orchestrateur)

Appondre **une ligne JSON** au `*.inbox.jsonl` du destinataire (+ miroir dans
son propre `*.outbox.jsonl`). Enveloppe (cf. `agents.json` → `coordination.envelope`) :

```jsonl
{"id":"gacha-0001","ts":"2026-05-29T10:00:00Z","from":"gacha","to":"integration","type":"request-wire","subject":"contrat gacha prêt","refs":["packages/api-contract/src/gacha.ts","ROUTES[]: /api/v1/gacha","ENFORCED: app/api/v1/gacha/"],"body":"Câbler l'export dans index.ts + entrée openapi + préfixe ENFORCED."}
```

Types : `claim · release · request-wire · wired · blocked · unblocked ·
review-request · review-done · done · note`.

## Règles anti-collision (résumé — détail dans `agents.json`)

1. **Éditer uniquement ses `owns[]`.** Jamais `git add -A` — stage les chemins possédés.
2. **Fichiers d'agrégation** (`shared_resources` : `index.ts`, `openapi.ts`,
   `check-dal-boundary.ts`, `data-source.ts`, `package.json`…) → écrits **seulement**
   par la lane `integration`. Les autres envoient `request-wire` et attendent `wired`.
3. **Gate scopé au vert avant commit** : `tsc --noEmit` + `oxlint .` + `check-dal-boundary.ts`.
4. **Worktree optionnel** : spawn avec `isolation:'worktree'` pour un parallélisme
   total ; chemins disjoints ⇒ zéro conflit au rebase sur `main`.

## Ordre d'exécution (dépendances `lanes[].depends_on`)

```
integration (actif)
  ├─ search, parts            (PILOTE — review)
  ├─ rankings, tournaments    (Phase 2, vague 1)
  ├─ decks, users             (vague 2)  ── users débloque gacha + auth
  │    └─ gacha               (vague 3, le plus gros : 11)
  ├─ anime, stream            (vague 4)
  ├─ cms, analytics           (vague 5)
  ├─ moderation, infra, discord-bridge
  ├─ graphql                  (Phase 3 — après les domaines)
  └─ auth                     (DERNIER — better-auth, colonnes mode:date)
```
