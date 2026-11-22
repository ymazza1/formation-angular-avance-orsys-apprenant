# TP 1 — Le workspace Maison&Co

**Durée** 45 min · **Rouges au départ** 17, dont **12 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Vous reprenez Maison&Co, un site de vente de mobilier. Le workspace Nx existe
déjà : l'application `boutique` et sept bibliothèques ont été générées. Mais
personne n'a posé de règles : n'importe quelle bibliothèque peut aujourd'hui
importer n'importe quelle autre.

Votre mission : rendre l'architecture **vérifiable par l'outillage**, pas par
la bonne volonté de l'équipe.

```
apps/boutique/                  l'application
libs/catalogue/domaine/         types et règles métier du catalogue
libs/catalogue/data-access/     HTTP, façades, état
libs/catalogue/ui/              composants de présentation
libs/catalogue/feature/         pages routées
libs/livraison/domaine/         règles de coût de livraison
libs/livraison/data-access/     jetons d'injection, composition des stratégies
libs/partage/util/              helpers transverses
```

Les bibliothèques sont vides : c'est normal, on les remplira au TP 2.

Pour **voir** le problème avant de le corriger, ouvrez le graphe :

```bash
npx nx graph
```

Il est plat : aucune bibliothèque ne dépend d'une autre, puisqu'elles sont vides.
Gardez cet onglet ouvert, on y reviendra à chaque TP.

## Ce qui vous est fourni

Les tags de l'application et des **quatre** bibliothèques `catalogue/*` sont
déjà posés : ouvrez leur `project.json`, ce sont vos exemples. Il vous reste les
trois autres projets.

## Comment savoir si vous avez fini

```bash
npm install --legacy-peer-deps
npm run test:structure
```

> `--legacy-peer-deps` est nécessaire : quelques paquets de l'écosystème
> déclarent encore des plages de pairs antérieures à Angular 22. C'est sans
> conséquence ici.

**Pourquoi 17 rouges et pas 12 ?** Cinq tests *bonus* (axe fonctionnel) lisent
la configuration que vous allez écrire à l'étape 2 : ils passent seuls au vert.

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 17 |
| l'étape 1 | 11 (6 écrits) |
| l'étape 2 | 0 (6 écrits + 5 bonus qui passent seuls) |

Ouvrez `tools/structure/structure.spec.ts`. Ce fichier n'est pas à modifier —
c'est votre cahier des charges. Lisez les messages d'échec : ils décrivent
précisément ce qui est attendu.

## Étape 1 — Poser les tags (6 tests)

Chaque projet porte **deux** tags : un de type (sa couche technique) et un de
domaine (son périmètre fonctionnel). Ils se déclarent dans le `project.json`
de chaque projet :

```json
{
  "name": "catalogue-data-access",
  "tags": ["type:data-access", "domaine:catalogue"]
}
```

À poser sur : `libs/livraison/domaine`, `libs/livraison/data-access` et
`libs/partage/util`.

Les types disponibles : `app`, `feature`, `ui`, `data-access`, `domaine`,
`util`. Les domaines : `boutique`, `catalogue`, `livraison`, `partage`.

À vous de déduire les valeurs à partir du nom de chaque bibliothèque, en vous
appuyant sur les exemples fournis. Les tests vous diront si vous vous êtes
trompé.

## Étape 2 — Déclarer les contraintes (6 tests)

`eslint.config.mjs`

La règle `@nx/enforce-module-boundaries` est bien activée, mais son tableau
`depConstraints` est vide : elle ne protège rien.

Avant d'écrire, répondez à l'oral, en binôme :

1. Un composant de `catalogue/ui` doit-il pouvoir appeler `CatalogueApi` ?
   Pourquoi ?
2. `catalogue/domaine` doit-il pouvoir importer `partage/util` ? Et l'inverse ?
3. `livraison/domaine` doit-il connaître `catalogue/domaine` ?
4. Si demain on extrait le catalogue dans une autre application, quelles
   bibliothèques emporte-t-on ?

Puis complétez le tableau. Deux familles de contraintes :

**Axe technique** — la dépendance va toujours vers le bas :

| Depuis            | Peut importer                                                |
| ----------------- | ------------------------------------------------------------ |
| `type:app`        | `feature`, `ui`, `util`                                       |
| `type:feature`    | `feature`, `ui`, `data-access`, `domaine`, `util`             |
| `type:ui`         | `ui`, `domaine`, `util`                                       |
| `type:data-access`| `data-access`, `domaine`, `util`                              |
| `type:domaine`    | `domaine`, `util`                                             |
| `type:util`       | `util`                                                        |

**Axe fonctionnel** — qui a le droit de connaître quel domaine :

| Depuis              | Peut importer                                  |
| ------------------- | ---------------------------------------------- |
| `domaine:boutique`  | tout (`*`)                                     |
| `domaine:catalogue` | `catalogue`, `livraison`, `partage`            |
| `domaine:livraison` | `livraison`, `partage`                         |
| `domaine:partage`   | `partage`                                      |

Syntaxe :

```js
{ sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:ui', 'type:domaine', 'type:util'] },
```

Les tests de l'étape vérifient l'axe technique ; ceux de l'axe fonctionnel sont
dans le bonus ci-dessous, et passent au vert quand vous avez tout écrit.

## Étape 3 — Provoquer une violation

C'est l'étape la plus importante du TP : il faut avoir **vu** l'erreur une
fois pour la reconnaître plus tard.

Dans `libs/catalogue/ui/src/index.ts`, ajoutez :

```ts
import { CatalogueApi } from '@maison/catalogue/data-access';
```

Puis :

```bash
npx nx lint catalogue-ui
```

Lisez le message en entier. Il ressemble à :

```
A project tagged with "type:ui" can only depend on libs tagged with
"type:ui", "type:domaine", "type:util"   @nx/enforce-module-boundaries
```

Il nomme le tag source et les tags autorisés. C'est ce message que verra votre
collègue, dans six mois, au moment où il essaiera de prendre le raccourci.

Retirez ensuite l'import : le lint doit redevenir vert.

## Vérification finale

- [ ] `npm run test:structure` : 33 tests verts
- [ ] `npx nx run-many -t lint` : vert
- [ ] L'import interdit de l'étape 3 produisait bien une erreur de lint

## Bonus — Les tags croisés

Les deux axes s'appliquent **en même temps** : une dépendance doit les
satisfaire tous les deux. Lisez `tools/structure/structure.bonus.spec.ts`
(5 tests, verts dès que l'étape 2 est écrite).

Provoquez le cas qui ne se voit que sur le deuxième axe : dans
`libs/livraison/domaine/src/index.ts`, importez `@maison/catalogue/domaine`.

```bash
npx nx lint livraison-domaine
```

Le type est permis (`domaine` → `domaine`) ; c'est le domaine qui ne l'est pas.
Lisez le message, puis retirez l'import. Quel axe a produit l'erreur ?

## Bonus — Mesurer l'effet sur la CI

```bash
git add -A && git commit -m "tags et frontières"
# modifiez un fichier de libs/catalogue/ui, puis :
npx nx affected -t lint --base=HEAD
npx nx run-many -t lint
```

Comparez le nombre de projets exécutés dans les deux cas : un projet contre
huit. C'est la différence entre une CI de trois minutes et une CI de vingt.

> Si `affected` exécute **tout**, c'est qu'un fichier racine a changé et n'est pas
> commité (typiquement `package-lock.json`) : Nx considère alors que tout est
> affecté. Commitez d'abord.
