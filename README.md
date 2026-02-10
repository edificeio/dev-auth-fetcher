# dev-auth-fetcher

CLI pour connecter un environnement local aux environnements de recette et injecter les cookies d'authentification (XSRF-TOKEN, oneSessionId) dans les fichiers `.env` des frontends Vite.

**Fonctionne sur MacOS, Linux et Windows.**

## Prérequis

- **Node.js** >= 24
- **pnpm** (gestionnaire de paquets)
- Les applications cibles ont une structure `/<racine_apps>/<application>/frontend/.env`

## Installation

```bash
git clone <repo>
cd dev-auth-fetcher
pnpm install
pnpm run build
```

Pour installer Playwright (navigateur headless utilisé pour l'authentification) :

```bash
pnpm exec playwright install chromium
```

## Utilisation

### Premier lancement : onboarding

Configure le répertoire racine des applications et génère les fichiers de configuration des environnements :

```bash
pnpm run dev onboard
# ou après build :
node bin/dev-auth-fetcher onboard
```

Vous serez invité à saisir le chemin du répertoire contenant vos applications (chaque app ayant un dossier `frontend`). Les fichiers dans `config/environments/` (recette-ode1, recette-ode2, recette-release, local) sont créés par défaut.

### Connexion et injection des cookies

Se connecter à un environnement de recette et mettre à jour les `.env` des applications choisies :

```bash
pnpm run dev connect
# ou
node bin/dev-auth-fetcher connect
```

Options de la commande `connect` :

- `-e, --env <id>` : identifiant de l'environnement (ex. `recette-ode1`)
- `-a, --app <name>` : nom d'une application cible
- `--all` : cibler toutes les applications détectées
- `-l, --login <login>` : login utilisateur (sinon demandé en interactif)

Exemples :

```bash
dev-auth-fetcher connect --env recette-ode1 --all
dev-auth-fetcher connect -e recette-ode2 -a mon-app -l mon.login
```

### Lister les applications

Affiche les applications détectées (avec dossier `frontend`) dans le répertoire configuré :

```bash
dev-auth-fetcher list-apps
```

## Structure des fichiers

- **Configuration globale** : `config/app.config.json`  
  - `appsRoot` : chemin racine des applications  
  - `defaultEnvironment` : environnement par défaut  
  - `profiles` : profils utilisateur (optionnel)

- **Environnements** : un fichier par environnement dans `config/environments/`  
  - Ex. `recette-ode1.json` : `{ "id", "label", "url" }`

- **Fichier .env cible** (dans chaque `application/frontend/.env`) :
  - `VITE_XSRF_TOKEN=...`
  - `VITE_ONE_SESSION_ID=...`
  - `VITE_RECETTE=<url>`

## Scripts

| Commande      | Description                |
|---------------|----------------------------|
| `pnpm dev`    | Exécution en mode dev (ts-node) |
| `pnpm build`  | Build de la CLI (sortie dans `dist/`) |
| `pnpm test`   | Lance les tests (Vitest)   |
| `pnpm lint`   | ESLint sur `src/`          |

## Cross-platform

- Les chemins sont gérés avec `path.join` / `path.resolve` pour être valides sur Windows, MacOS et Linux.
- Les fichiers de configuration sont lus/écrits en UTF-8.
- En cas d’échec de Playwright (navigateur non installé), exécuter :  
  `pnpm exec playwright install chromium`

## Licence

Usage interne / équipe.
