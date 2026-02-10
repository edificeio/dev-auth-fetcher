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

Vous serez invité à saisir le chemin du répertoire contenant vos applications (chaque app ayant un dossier `frontend`). Les fichiers dans `config/environments/` (recette-ode1, recette-ode2, ..., recette-release, local) sont créés par défaut.

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

Lors du premier `connect` pour un environnement, vous saisissez login et mot de passe ; après une connexion réussie, ils sont enregistrés. Aux connexions suivantes pour le même environnement, vous pouvez choisir un identifiant déjà enregistré ou « Nouvel identifiant ». Les credentials sont stockés par environnement et par utilisateur dans un fichier **non versionné** (voir ci-dessous).

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

- **Identifiants enregistrés** (par utilisateur, **non versionnés**, répertoire dans `.gitignore`) :
  - Répertoire : `.dev-auth-fetcher/credentials/` (à la racine du répertoire depuis lequel vous lancez la CLI).
  - Fichier : `<userId>.json` (par défaut `userId` = nom d’utilisateur système ; peut être surchargé avec la variable d’environnement `DEV_AUTH_USER`).
  - Contenu : liste de profils (login + mot de passe) par environnement.

## Scripts

| Commande      | Description                |
|---------------|----------------------------|
| `pnpm dev`    | Exécution en mode dev (tsx, sources TypeScript ESM) |
| `pnpm build`  | Build ESM de la CLI (sortie dans `dist/`) |
| `pnpm test`   | Lance les tests (Vitest)   |
| `pnpm lint`   | ESLint sur `src/`          |

## Cross-platform

- Les chemins sont gérés avec `path.join` / `path.resolve` pour être valides sur Windows, MacOS et Linux.
- Les fichiers de configuration sont lus/écrits en UTF-8.
- En cas d’échec de Playwright (navigateur non installé), exécuter :  
  `pnpm exec playwright install chromium`

## Licence

Usage interne / équipe.
