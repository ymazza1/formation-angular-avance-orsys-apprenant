# TP 0 — Mise en route

**Durée** 20 min · **Rouges après l'installation** 7, dont **3 à écrire** · les 4 autres passent au vert dès que l'API tourne

## Pourquoi ce TP

Il n'a aucune valeur pédagogique. Il existe pour qu'aucun des dix TP suivants
ne soit retardé par un problème d'installation. On le fait tous ensemble, et on
ne passe pas au TP 1 tant que tout le monde n'est pas vert.

À la fin, vous aurez aussi branché l'application sur l'API — ce sera votre
première ligne de code du séjour.

## Comment savoir si vous avez fini

```bash
npm run test:environnement   # l'environnement et l'API
npx nx test partage-util     # le branchement de l'API
```

Les deux doivent être verts.

| Après… | Rouges restants |
| --- | --- |
| l'étape 1 (installation) | 7 : 4 de l'API éteinte + 3 de `API_URL` |
| l'étape 2 (API lancée) | 3 |
| l'étape 3 (`API_URL`) | 0 |

## Étape 1 — Installer le workspace

```bash
node --version               # 22 ou plus récent
npm install --legacy-peer-deps
```

> Le `--legacy-peer-deps` est nécessaire : quelques paquets de l'écosystème
> déclarent encore des plages de pairs antérieures à Angular 22. Sans
> conséquence pour la formation.

Vérification :

```bash
npm run test:environnement
```

Les six premiers tests (poste de travail, versions attendues) passent au vert.
Les quatre tests « API de démonstration » restent rouges : c'est l'étape suivante.

## Étape 2 — Lancer l'API et l'application

L'API vit dans `api/`, indépendamment du workspace Angular. **Gardez-la dans un
terminal dédié pendant les trois jours.**

```bash
npm --prefix ./api install     # une seule fois
npm run api                    # terminal dédié
```

Vérifiez dans le navigateur : <http://localhost:3333/api/sante>

```json
{ "statut": "ok", "produits": 20, "latence": 250, "tauxErreur": 0 }
```

et <http://localhost:3333/api/produits> : c'est le catalogue de 20 produits que
vous afficherez à partir du TP 2.

Dans le premier terminal :

```bash
npm run test:environnement     # les 10 tests sont verts
npx nx serve boutique
```

<http://localhost:4200> affiche une page presque vide avec un lien
« Maison&Co ». C'est normal : les bibliothèques sont encore vides, on les
remplira à partir du TP 2.

Deux variantes de l'API serviront plus tard — inutile de les lancer aujourd'hui :

```bash
npm run start:instable      # 30 % d'erreurs, 600 ms de latence   → TP 3
npm run start:jeton-court   # jeton valable 10 secondes           → TP 8
```

(à lancer depuis le dossier `api/`)

## Étape 3 — Brancher `API_URL` (3 tests)

`libs/partage/util/src/lib/api-url.ts`

La fabrique du jeton renvoie une chaîne vide : à vous de la remplir.

```bash
npx nx test partage-util
```

Trois tests rouges décrivent ce qui est attendu : renseigné, URL absolue, se
terminant par `/api` sans barre oblique finale. Un quatrième, « peut être
remplacé en test », est déjà vert : il vous dit ce que le jeton permet.

Deux questions à se poser en le faisant :

1. Pourquoi un `InjectionToken` plutôt qu'une constante exportée ?
   Indice : regardez le quatrième test.
2. Pourquoi `providedIn: 'root'` avec une `factory` plutôt qu'un provider
   déclaré dans `app.config.ts` ?

## Vérification finale

- [ ] `npm run test:environnement` : 10 tests verts
- [ ] `npx nx test partage-util` : 4 tests verts
- [ ] `npx nx build boutique` : réussit
- [ ] `localhost:4200` affiche l'application
- [ ] L'API tourne dans un terminal dédié, et y reste

## Bonus — Vérifier la version de Node

Le premier test de `test:environnement` (« tourne sur Node 22 ou plus récent »)
le fait déjà. Si vous êtes en dessous, installez une version récente avant d'aller
plus loin (`nvm install 22` si vous avez nvm), puis relancez l'installation.
Pourquoi un test plutôt qu'une ligne dans un README ?

## Bonus — Installer l'outillage navigateur

- **Angular DevTools** — <https://angular.dev/tools/devtools>
  Installez l'extension, ouvrez les DevTools sur `localhost:4200` et vérifiez
  que les onglets *Components* et *Profiler* apparaissent. On s'en servira
  intensivement au jour 2.
- **VS Code** : extension *Angular Language Service*.

## Si ça coince

Mettez-vous en binôme avec un voisin dont l'environnement fonctionne, et
signalez le problème au formateur. Un poste qui résiste ne doit pas consommer
le TP 1 : on repassera dessus pendant que les autres travaillent.
