# dev-auth-fetcher

CLI pour connecter un environnement local aux environnements de recette et injecter les cookies d'authentification (XSRF-TOKEN, oneSessionId) dans les fichiers `.env` des frontends Vite.

**Fonctionne sur MacOS, Linux et Windows.** Projet en **ESM** (`"type": "module"`).

## Prérequis

- **Node.js** >= 24
- **pnpm** (gestionnaire de paquets)
- Les applications cibles ont une structure :
  - à la racine : `/<racine_apps>/<application>/frontend/.env`
  - ou sous entcore : `/<racine_apps>/entcore/<application>/frontend/.env`

## Installation

```bash
git clone <repo>
cd dev-auth-fetcher
pnpm install
pnpm run build
```

## Commandes

| Commande           | Description |
|--------------------|-------------|
| `onboard`          | Configurer le répertoire racine des apps et générer les configs d'environnements |
| `connect`          | Se connecter à un environnement et mettre à jour les `.env` des applications |
| `list-apps`        | Lister les applications détectées (avec dossier `frontend`) |
| `reconnect-last`   | Reconnexion automatique avec le dernier combo env / login / apps (sans prompts) |

## Utilisation

### Premier lancement : onboarding

Configure le répertoire racine des applications et génère les fichiers de configuration des environnements :

```bash
pnpm run dev onboard
# ou après build :
node bin/dev-auth-fetcher onboard
```

Vous serez invité à saisir le chemin du répertoire contenant vos applications : soit des dossiers `<app>/frontend` à la racine, soit (ou en plus) un sous-dossier `entcore` avec des apps `entcore/<app>/frontend`. Les fichiers dans `config/environments/` (recette-ode1, recette-ode2, recette-release, local) sont créés par défaut.

### Connexion et injection des cookies

Se connecter à un environnement de recette et mettre à jour les `.env` des applications choisies :

```bash
pnpm run dev connect
# ou
node bin/dev-auth-fetcher connect
```

Options de la commande `connect` :

- `-e, --env <id>` : identifiant de l'environnement (ex. `recette-ode1`)
- `-a, --app <name>` : nom ou id d'application (ex. `mon-app` ou `entcore/mediacentre` pour une app sous entcore)
- `--all` : cibler toutes les applications détectées
- `-l, --login <login>` : login utilisateur (sinon demandé en interactif)
- `--watch` : maintenir la session vivante par keep-alive (voir [Mode watch](#mode-watch--watch))
- `--watch-interval <minutes>` : intervalle des pings keep-alive (défaut 2)

Lors du premier `connect` pour un environnement, vous saisissez **login**, **mot de passe** et éventuellement un **rôle** (ex. Enseignant, Élève) pour identifier le compte. Après une connexion réussie, ces informations sont enregistrées. Aux connexions suivantes pour le même environnement, vous pouvez choisir un identifiant déjà enregistré (affiché avec le rôle entre parenthèses) ou « Nouvel identifiant ». Les identifiants sont **triés en faisant remonter les derniers utilisés**. Les credentials sont stockés par environnement et par utilisateur dans un fichier **non versionné** (voir [Structure des fichiers](#structure-des-fichiers)).

#### Reconnexions rapides

En mode interactif (sans `-e`), `connect` propose en tête de liste les **dernières connexions** (jusqu'à 3 : combo *environnement / login / apps*), chacune annotée de sa fraîcheur (« connecté il y a 3h12 », avec ⚠️ si la session est probablement expirée). Sélectionnez-en une pour la rejouer directement. Pratique quand on jongle entre plusieurs sujets avec des comptes différents.

Exemples :

```bash
dev-auth-fetcher connect --env recette-ode1 --all
dev-auth-fetcher connect -e recette-ode2 -a mon-app -l mon.login
dev-auth-fetcher connect -e recette-ode1 -a entcore/mediacentre   # app sous entcore
```

### Reconnexion automatique (reconnect-last)

Réutilise le dernier environnement, login et sélection d'applications enregistrés. Aucune question : connexion et mise à jour des `.env` directement.

```bash
dev-auth-fetcher reconnect-last
```

À utiliser après avoir fait au moins une fois `connect` (avec sélection d'apps). Si aucune dernière connexion n'est enregistrée, un message vous invitera à lancer d'abord `connect`.

### Mode watch (`--watch`)

Les sessions de recette expirent après une période d'inactivité : votre front local se met alors à recevoir des 401. Le mode `--watch` **maintient la session vivante** par un **ping keep-alive régulier** (premier plan, `Ctrl+C` pour arrêter) :

```bash
dev-auth-fetcher connect -e recette-ode1 -a mon-app --watch
dev-auth-fetcher connect -e recette-ode1 -a mon-app --watch --watch-interval 3   # ping toutes les 3 min
```

À chaque intervalle (défaut **2 min**, réglable via `--watch-interval <minutes>`), l'outil sonde la session. L'intervalle doit rester **inférieur au timeout d'inactivité du serveur** (observé ≈ 5 min sur les recettes) pour que le ping réarme la session avant son expiration :

- **session vivante** → rien n'est touché. Le ping lui-même réarme le timeout d'inactivité côté serveur, donc la session reste active **sans réécrire le `.env`** et **sans reload Vite**.
- **session tombée** → l'outil **ré-authentifie et réinjecte** les `.env`. C'est le **seul** moment où le `.env` change.

> ⚠️ **À savoir** : quand le `.env` est réécrit (uniquement à la ré-authentification), Vite **surveille les `.env`**, **redémarre le dev-server** et **recharge la page** (perte de l'état HMR). En keep-alive nominal, ça n'arrive pas — le reload n'a lieu que si la session a réellement expiré.

### Lister les applications

Affiche les applications détectées (avec dossier `frontend`) dans le répertoire configuré :

```bash
dev-auth-fetcher list-apps
```

## Structure des fichiers

- **Configuration globale** : `config/app.config.json`  
  - `appsRoot` : chemin racine des applications  
  - `defaultEnvironment` : environnement par défaut  

- **Environnements** : un fichier par environnement dans `config/environments/`  
  - Ex. `recette-ode1.json` : `{ "id", "label", "url" }`

- **Fichier .env cible** (dans chaque `application/frontend/.env` ou `entcore/application/frontend/.env`) :
  - `VITE_XSRF_TOKEN=...`
  - `VITE_ONE_SESSION_ID=...`
  - `VITE_RECETTE=<url>`

- **Identifiants enregistrés** (par utilisateur, **non versionnés**, répertoire dans `.gitignore`) :
  - Répertoire : `.dev-auth-fetcher/credentials/` (à la racine du répertoire depuis lequel vous lancez la CLI).
  - Fichier : `<userId>.json` (par défaut `userId` = nom d'utilisateur système ; peut être surchargé avec la variable d'environnement `DEV_AUTH_USER`).
  - Contenu : profils par environnement (login, mot de passe, rôle optionnel) et **historique des dernières connexions** (jusqu'à 3 : env, login, apps, horodatage et expiration estimée) pour les reconnexions rapides et `reconnect-last`.

## Scripts

| Commande           | Description |
|--------------------|-------------|
| `pnpm dev`         | Exécution en mode dev (tsx, sources TypeScript ESM) |
| `pnpm build`       | Build ESM de la CLI (sortie dans `dist/`) |
| `pnpm start`      | Exécution du build : `node dist/index.js` |
| `pnpm test`        | Lance les tests (Vitest) |
| `pnpm lint`        | ESLint sur `src/` et `tests/` |
| `pnpm format`      | Prettier : formatage des fichiers TS |
| `pnpm format:check`| Prettier : vérification du format sans écriture |

## Cross-platform

- Les chemins sont gérés avec `path.join` / `path.resolve` pour être valides sur Windows, MacOS et Linux.
- Les fichiers de configuration sont lus/écrits en UTF-8.
- L'authentification s'effectue via un appel HTTP (fetch) vers l'endpoint `/auth/login` des environnements de recette.

## Licence

Usage interne / équipe.
