# TP 5 — Le panier en signals

**Durée** 55 min · **Rouges au départ** 20, dont **15 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Le bouton « Ajouter au panier » du TP 2 écrit dans la console. Il est temps
qu'il fasse quelque chose.

Le panier est le cas d'école de la dérivation : un contenu, et une cascade de
montants qui en découlent (sous-total, remise, frais de livraison, total).
Chacun de ces montants pourrait être stocké. Aucun ne doit l'être.

## Ce qui vous est fourni

Lisez-le avant d'écrire : c'est la forme cible.

| Fichier | Rôle |
| --- | --- |
| `libs/panier/domaine/.../panier.ts` | `ajouter` (le modèle : fusion, stock, plafond, rupture), `ligneDepuisProduit`, `nbArticles`, `sousTotal`, `remise` |
| `libs/panier/ui/.../ligne-panier.component.ts` | La ligne modifiable, avec `model()` pour la quantité (8 tests verts) |
| `libs/panier/data-access/.../panier.store.ts` | Le signal `_lignes`, `nbArticles` et `estVide`, la persistance (`restaurer` + le seul `effect`), le code promo. Les commandes ne font encore rien, et les quatre montants valent 0 |
| `libs/catalogue/feature/.../catalogue.page.ts` | Le récapitulatif du panier, branché sur le store, et « Ajouter » qui appelle `panier.ajouter()` |
| `apps/boutique/.../app.config.ts` | `fournirStrategiesLivraison()` enregistré à la racine : `PanierStore` injecte les stratégies, et sans elles le catalogue reste vide (un seul `NG0201` en console) |

Lancez l'application : le récapitulatif s'affiche, mais « Ajouter » ne fait rien
et tous les montants sont à 0. Les trois étapes le rendent vrai.

## Un nouveau domaine, trois bibliothèques

```
libs/panier/domaine/       type:domaine,     domaine:panier
libs/panier/data-access/   type:data-access, domaine:panier
libs/panier/ui/            type:ui,          domaine:panier
```

Elles sont déjà créées et taguées. `domaine:panier` peut atteindre
`domaine:catalogue` (il lui faut `Produit`) et `domaine:livraison` (il lui faut
`coutLivraison`), mais **pas l'inverse**.

Une exception, à regarder dans `eslint.config.mjs` : `catalogue/feature` importe
`panier/data-access` et `panier/ui`, pour le bouton et le récapitulatif. Cette
dérogation est explicite et commentée, et elle ne va **que dans ce sens** : le
catalogue peut déclencher un ajout, le panier n'a aucune raison d'afficher un
catalogue. Vérifiez-le avec `npx nx graph`, et cherchez la flèche qui n'existe
pas.

Une seconde exception, plus étroite, dans le même fichier : `allow:
['@maison/livraison/data-access']`. La racine (`app.config.ts`) doit enregistrer
les stratégies de livraison, alors que la règle `type:app` lui interdit les
data-access. Plutôt que d'ouvrir toute la couche, on exempte ce seul module. On
comptera ces exceptions au TP 8.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 20 rouges au départ, tous verts à la fin
npm run test:structure       # vert, et doit le rester
npx nx run-many -t lint      # vert
```

**Pourquoi 20 rouges et pas 15 ?** Cinq tests passent seuls quand vos commandes
et vos montants existent : deux de persistance (le code est fourni, mais il faut
un panier non vide à persister) et trois du code promo (bonus). Vous n'avez rien
à y écrire.

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 20 |
| l'étape 1 | 12 |
| l'étape 2 | 5 (4 écrits + 3 qui passent seuls) |
| l'étape 3 | 0 (3 écrits + 2 qui passent seuls) |

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.

## Étape 1 — Le domaine du panier (8 tests)

`libs/panier/domaine/src/lib/panier.ts`

Toutes les fonctions sont pures, aucune ne modifie son argument. Lisez d'abord
`ajouter`, fournie : c'est la forme à suivre. Trois fonctions sont à écrire.

| Fonction | Règle, couverte par un test |
| --- | --- |
| `retirer` | supprime la ligne demandée, conserve les autres |
| `changerQuantite` | remplace la quantité, bornée au `stockDisponible` de la ligne ; **0 ou moins retire la ligne** ; un produit absent ne change rien |
| `versLignesLivrables` | traduit chaque ligne en `{ poidsKg, volumeM3, quantite, montant }`, et ne laisse fuir ni le nom ni l'identifiant |

`versLignesLivrables` mérite une explication. La livraison n'a besoin que de
poids, volume, quantité et montant. Lui passer le `Produit` complet créerait une
dépendance qui n'a pas lieu d'être, et le test vérifie les clés produites.

Notez que la ligne mémorise `stockDisponible` **au moment de l'ajout**. Le stock
a pu changer depuis : c'est une question pour plus tard, pas pour ce TP.

## Étape 2 — Les commandes du store (4 tests)

`libs/panier/data-access/src/lib/panier.store.ts`

`ajouter`, `retirer`, `changerQuantite`, `vider`. Chacune tient en une ligne :

```ts
ajouter(produit: Produit, quantite = 1): void {
  this._lignes.update((panier) => ajouter(panier, produit, quantite));
}
```

`vider` remet `PANIER_VIDE` **et** retire le code promo (`retirerCodePromo()`,
fourni) : un code n'a pas de sens sur un panier vide.

**Le store ne contient aucune règle métier.** Il porte un signal et délègue au
domaine. Si vous vous surprenez à écrire un `if` dans le store, la règle est
probablement au mauvais endroit.

Le test « produit une nouvelle référence à chaque modification » verrouille
l'immutabilité : même leçon qu'au TP 4, sur un tableau cette fois.

Dans le navigateur : « Ajouter » remplit le récapitulatif, ajouter deux fois le
même produit incrémente au lieu de dupliquer. Les montants, eux, restent à 0.

## Étape 3 — La chaîne de dérivation (3 tests)

Toujours `panier.store.ts`. Un seul signal en écriture, privé : `_lignes`. Tout
le reste est `computed` :

```
_lignes ──┬─→ nbArticles
          ├─→ estVide
          ├─→ sousTotal ──┬─→ remise ──┐
          │               │            ├─→ total
          └─→ fraisLivraison ──────────┘
```

Écrivez `sousTotal`, `fraisLivraison`, `remise` et `total`, en appelant le
domaine (`sousTotal`, `versLignesLivrables`, `remise`) et `coutLivraison` avec
`this.strategies`.

Aucun montant n'est stocké. Aucun n'est recalculé inutilement : un `computed` ne
s'exécute que si une de ses dépendances a changé, et seulement si quelqu'un le
lit.

Deux points d'attention :

- le total est `sousTotal − remise + fraisLivraison`, arrondi au centime
  (`arrondirCentimes` est en bas du fichier) ;
- `total` se construit sur les **autres `computed`** (`this.sousTotal()`,
  `this.remise()`…), pas en recalculant depuis `_lignes` : c'est ce qui en fait
  une chaîne, et ce qui garde un seul endroit par règle.

### Dans le navigateur

- changer une quantité recalcule les trois montants ;
- mettre 0 retire la ligne ;
- ajoutez un canapé (1 290 €) : la livraison passe à 0, franco atteint ;
- **rechargez la page** : le panier est toujours là.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run test:structure` : vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] Aucun montant n'est stocké dans un signal en écriture
- [ ] Un seul `effect` dans tout le store
- [ ] Le panier survit à un rechargement

## Les deux questions de fin

1. Combien de `computed` sont recalculés quand on change la quantité d'une ligne ?
   Et si `total` avait été un signal mis à jour par un `effect` ?
2. `stockDisponible` est figé au moment de l'ajout. Que se passe-t-il si le stock
   tombe à zéro pendant que le produit est au panier ?

## Bonus — Le code promo

Lisez `appliquerCodePromo` dans le store et `panier.store.bonus.spec.ts`. L'appel
`GET /api/promotions/{code}` a trois issues, et **trois états distincts** : code
accepté, code refusé, panne de vérification. Afficher « code invalide » quand
l'API est en panne est un mensonge à l'utilisateur, qui va réessayer le même code
indéfiniment.

Les cinq tests sont verts une fois l'étape 3 écrite : la remise passe par votre
`computed`. Codes valides pour essayer : `BIENVENUE10`, `MEUBLE20`. Pour aller
plus loin, ajoutez un champ de code promo dans le récapitulatif de la page.

## Bonus — La persistance, et le seul effect du store

Lisez le constructeur du store : `restaurer()`, puis un `effect` qui écrit
`_lignes` dans `localStorage`.

**C'est le seul `effect` du store, et il est légitime** : il synchronise un
système extérieur avec l'état réactif. Il ne calcule rien, il n'écrit dans aucun
signal. Le critère, à retenir pour la suite : *un `effect` qui appelle `set()` sur
un signal est presque toujours un `computed` déguisé.*

Deux détails que les tests de persistance exigent : `localStorage` peut lever
(navigation privée, quota), et un contenu stocké illisible ne doit pas empêcher
l'application de démarrer. Supprimez le `try` de `restaurer()` : le test « repart
d un panier vide si le contenu stocké est illisible » passe au rouge. Remettez-le.
