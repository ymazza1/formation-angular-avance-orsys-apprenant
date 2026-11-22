# TP 2 — Architecture du catalogue

**Durée** 60 min · **Rouges au départ** 29, dont **19 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Les frontières sont posées (TP 1), les bibliothèques sont vides. On va les
remplir — et vérifier que les règles tiennent sous la charge d'une vraie
fonctionnalité.

À la fin, le catalogue Maison&Co s'affiche dans le navigateur, alimenté par
l'API, sans qu'aucun composant ne connaisse `HttpClient`.

## Ce qui vous est fourni

Ce code n'est pas du remplissage : c'est **la forme cible**. Lisez-le avant
d'écrire, il fait gagner du temps.

| Fichier | Rôle | Tests verts |
| --- | --- | --- |
| `catalogue/domaine/.../filtres.ts` | Filtres : `appliquer`, `estVide`, `rechercheExploitable` | 10 |
| `catalogue/data-access/.../catalogue.api.ts` | Port HTTP : `versParams`, `CatalogueApi` | 5 (+ 3 après l'étape 2) |
| `catalogue/ui/.../carte-produit.component.ts` | Composant de présentation | 0 (+ 7 après l'étape 1) |
| `catalogue/feature/.../catalogue.page.ts` + route | La page et son branchement | — |
| `livraison/domaine/.../strategies.ts` + providers | Stratégies de livraison | 14 |
| `produit.ts` : `estVolumineux`, `estEnPromotion` | Les deux autres règles du produit | 4 |

Les tests fournis servent de documentation exécutable : **vous les lisez, vous
ne les écrivez pas**.

**Pourquoi 29 rouges et pas 19 ?** Deux fichiers fournis appellent des
fonctions que vous allez écrire : la carte appelle `prixEffectif` et
`estDisponible`, l'API appelle `versProduit`. Leurs 10 tests sont rouges tant
que ces fonctions lèvent, et passent **seuls** au vert : vous n'avez rien à y
écrire. Ça se lit dans le compteur :

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 29 |
| l'étape 1 | 17 (5 écrits + la carte qui passe seule) |
| l'étape 2 | 8 (6 écrits + l'API qui passe seule) |
| l'étape 3 | 0 |

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 29 rouges au départ, tous verts à la fin
npx nx run-many -t lint      # doit rester vert en permanence
```

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.
Les fonctions à écrire contiennent un `TODO TP 2` et lèvent une erreur
explicite tant qu'elles ne sont pas écrites.

```bash
npx nx test catalogue-domaine --watch
```

> Les **types** vous sont fournis (sinon les tests ne compileraient pas). Ce
> qui est à écrire, c'est le comportement, le mapping et la composition.

## Étape 1 — Le domaine : produit (5 tests, 7 de plus pour la carte)

`libs/catalogue/domaine/src/lib/produit.ts`

Deux fonctions : `prixEffectif` et `estDisponible`. Les deux autres règles du
fichier sont déjà écrites : lisez `estVolumineux` d'abord.

Contrainte vérifiée par les tests de structure : **aucun import d'Angular ni de
RxJS dans ce fichier**. Si vous en avez besoin, c'est que la règle n'est pas à
sa place.

Un piège que les tests attrapent : l'arrondi au centime (`249,90 € − 10 %` ne
fait pas `224,91` par hasard).

## Étape 2 — Le port : le DTO (6 tests, 3 de plus pour l'API)

`libs/catalogue/data-access/src/lib/produit.dto.ts`

`versProduit(dto)`. Regardez le `ProduitDto` : `prix_ttc`, `poids_kg`,
`nb_avis`. Il ne ressemble pas au `Produit` du domaine, et c'est voulu. Le
dernier test vérifie qu'aucun nom de champ du DTO ne fuit dans le modèle.

`catalogue.api.ts`, juste à côté, vous est fourni : c'est lui qui appelle
`versProduit`. Lisez-le pour voir **où** votre fonction est utilisée.

> L'API est ici **promise-based** (`firstValueFrom`). C'est délibérément naïf :
> le TP 3 vous fera constater ce que ça casse avant de le corriger.

## Étape 3 — La façade (8 tests)

`libs/catalogue/data-access/src/lib/catalogue.facade.ts`

C'est la pièce centrale. Deux règles :

1. **État en lecture seule.** Les signaux en écriture sont privés ; ce qui sort
   est `asReadonly()` ou `computed()`. `produits`, `total` et `facettes` sont
   des valeurs **dérivées** : elles ne doivent jamais être stockées.
2. **Commandes nommées.** Aucune méthode ne renvoie d'`Observable`, aucun
   composant ne peut modifier l'état autrement qu'en appelant une méthode qui
   dit ce qu'elle fait.

Le test qui compte le plus : `charger()` **ne rejette jamais**. Une erreur
réseau devient un état (`erreur()`), pas une exception à rattraper chez
l'appelant. Regardez le test « renseigne l erreur sans rejeter la promesse ».

## Vérification finale

```bash
npx nx run-many -t test      # tout vert
npx nx run-many -t lint      # vert
npm run test:structure       # vert : le domaine est resté pur
npm run api                  # dans un terminal dédié
npx nx serve boutique
```

- [ ] Le catalogue affiche 12 produits (la première page sur 20) et le filtre
      par pièce fonctionne
- [ ] `grep -rn "prix_ttc" libs/catalogue/ui libs/catalogue/feature` ne renvoie rien
- [ ] Aucun composant n'importe `HttpClient`

## La question à se poser en fin de TP

La façade a-t-elle apporté quelque chose, ou n'est-ce qu'une couche
d'indirection de plus ?

Gardez votre réponse. On la confrontera au TP 7, quand on remplacera toute son
implémentation par `httpResource` sans toucher à un seul composant.

## Bonus — La recherche et les accents

`etagere` doit trouver « Étagère ». À qui appartient cette règle : au client,
au domaine, ou à l'API ? Lisez `sansAccents` dans `api/server.js`, puis
`catalogue.api.bonus.spec.ts` : la conséquence côté client est que la saisie
est transmise **telle quelle**. Que perdrait-on à normaliser dans `versParams` ?

Ces tests sont verts dès l'ouverture du projet.

## Bonus — Les stratégies de livraison en multi-providers

Lisez `strategies.bonus.spec.ts`. Une troisième règle — `LivraisonExpress`,
colis de moins de 5 kg à 19 € — s'ajoute **sans modifier** `coutLivraison` ni les
deux stratégies existantes : un provider de plus. Le dernier test montre que
l'ordre des providers est une décision, pas un détail.

Pour aller plus loin : sortez `LivraisonExpress` du test, placez-la dans
`livraison/domaine`, et vérifiez que le seul fichier modifié côté Angular est
celui des providers.
