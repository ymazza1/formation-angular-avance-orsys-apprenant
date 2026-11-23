# TP 4 — Le stock temps réel, et pourquoi il ne s'affiche pas

**Durée** 45 min · **Rouges au départ** 10, dont **9 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Le catalogue affiche un stock figé : celui qui était en base au moment de la
requête. Sur un site de mobilier où il reste parfois trois exemplaires, ça ne
suffit pas.

On ajoute donc une surveillance du stock, rafraîchie à intervalle régulier. Et
c'est là que les choses deviennent intéressantes : **cette mise à jour se
produit en dehors de tout événement Angular**.

Sous Zone.js, ça marchait sans qu'on se pose de questions : Zone.js
interceptait le `setInterval` et déclenchait un cycle de détection global.
Notre application est zoneless. Rien n'intercepte plus rien.

## Ce qui vous est fourni

Lisez-le avant d'écrire : c'est la forme cible.

| Fichier | Rôle |
| --- | --- |
| `libs/catalogue/ui/.../badge-stock.component.ts` | Le badge : quatre niveaux calculés dans un `computed`, et `null` n'est pas `0` (7 tests verts) |
| `libs/catalogue/data-access/.../stock.store.ts` | Les signaux `_stocks` et `_surveilles`, le `computed` `nbSurveilles`, et la surveillance (`surveiller`, `rafraichir`, `interroger`). Elle fonctionne, mais sa minuterie fuit |

Quatre tests de structure vérifient que Zone.js n'est ni une dépendance ni un
polyfill, qu'aucun `NgZone` n'est injecté, et qu'aucun `detectChanges()` ne
traîne dans le code applicatif. Ils passent déjà : à vous de ne pas les casser,
et l'étape 1 va vous en donner l'envie.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 10 rouges au départ, tous verts à la fin
npm run test:structure       # vert, et doit le rester
npx nx run-many -t lint      # vert
```

**Pourquoi 10 rouges et pas 9 ?** Le test *bonus* « ignore une erreur réseau sans
perdre la valeur connue » lit la quantité que vous allez écrire à l'étape 1 : il
passe seul au vert, vous n'avez rien à y écrire.

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 10 |
| l'étape 1 | 4 (5 écrits + 1 bonus qui passe seul) |
| l'étape 2 | 2 |
| l'étape 3 | 0 |

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.

## Étape 1 — Voir le bug, puis écrire l'état

**Avant d'écrire le bon code, écrivez le mauvais.** Dix lignes suffisent, et
elles ne dépendent d'aucun code du TP : on les met directement dans
`CataloguePage` (`libs/catalogue/feature/src/lib/catalogue.page.ts`), on
observe, on efface. API et application lancées (`npm run api`,
`npx nx serve boutique`).

**Version 1 — un champ ordinaire.**

```ts
// dans CataloguePage, temporairement
protected compteurMutable = { valeur: 0 };

constructor() {
  this.facade.rafraichir();
  setInterval(() => {
    this.compteurMutable.valeur += 1;
    console.log('en mémoire :', this.compteurMutable.valeur);
  }, 1000);
}
```

```html
<p>Compteur : {{ compteurMutable.valeur }}</p>
```

**La console compte, l'écran reste à 0.** C'est aussi la preuve que
l'application est bien zoneless : sous Zone.js, ce code se rafraîchirait.

**Version 2 — un signal, mais muté.**

```ts
protected compteurSignal = signal({ valeur: 0 });

setInterval(() => {
  this.compteurSignal().valeur += 1;    // mutation de l'objet contenu
}, 1000);
```

```html
<p>Compteur : {{ compteurSignal().valeur }}</p>
```

**L'écran reste à 0 lui aussi.** C'est le piège central du TP : le signal
surveille **sa référence**, pas le contenu de ce qu'il contient.

**Version 3 — une nouvelle référence.**

```ts
setInterval(() => {
  this.compteurSignal.update((c) => ({ valeur: c.valeur + 1 }));
}, 1000);
```

**L'écran compte.** En binôme, formulez en une phrase pourquoi la version 2
échoue alors que la valeur est dans un signal : c'est celle que vous répéterez à
vos collègues. **Effacez ensuite les trois versions.**

Puis, dans `libs/catalogue/data-access/src/lib/stock.store.ts`, appliquez la
leçon à la `Map` des stocks : écrivez `enregistrer`, `quantite` et
`estDisponible`. La règle : **chaque mise à jour produit une nouvelle Map.**

```ts
this._stocks.update((precedents) => new Map(precedents).set(etat.id, etat));
```

Le test « produit une nouvelle référence à chaque mise à jour » vérifie que
l'ancienne Map est intacte : c'est plus fort que « ça se rafraîchit », ça
garantit qu'aucun code ne peut modifier l'état par un chemin détourné.

`quantite(id)` est une **méthode**, pas un signal. Comme elle lit
`this._stocks()`, l'appeler dans un template crée bien la dépendance.

## Étape 2 — Surveiller avec un effect

`libs/catalogue/feature/src/lib/catalogue.page.ts`

Dans le constructeur de `CataloguePage`, surveillez le stock des produits
affichés, et ajoutez le badge dans la grille, sous chaque carte :

```ts
effect(() => {
  const ids = this.facade.produits().map((produit) => produit.id);
  if (ids.length > 0) this.stocks.surveiller(ids);
});
```

```html
<mc-badge-stock [quantite]="stocks.quantite(produit.id)" />
```

(`StockStore` s'injecte dans la page, `BadgeStockComponent` s'ajoute à ses
`imports`.)

**Pourquoi un `effect`, et pas un `computed` ?** Un `computed` *calcule une
valeur* à partir d'autres signaux, sans rien toucher d'autre ; Angular peut ne
jamais l'évaluer si personne ne le lit. Ici on ne calcule rien : on
**synchronise un service extérieur** (une minuterie, des requêtes) avec un état
réactif. C'est le cas légitime de l'`effect`, et il y en a peu. Si vous vous
surprenez à écrire un `effect` qui fait `set()` sur un autre signal, c'est un
`computed` qu'il vous faut (ou un `linkedSignal`, voir le bonus).

Vérifiez dans le navigateur : les badges passent de « vérification » à leur
niveau tout seuls, sans clic ni `detectChanges()`.

## Étape 3 — Le nettoyage : la minuterie qui fuit

`libs/catalogue/data-access/src/lib/stock.store.ts`

Ouvrez l'onglet **Réseau**, puis changez plusieurs fois de pièce dans les
filtres et attendez quinze secondes : chaque nouvelle liste a lancé sa propre
minuterie, **aucune ne s'est arrêtée**. Une minuterie qui survit à son usage,
c'est une rafale de requêtes HTTP toutes les quinze secondes jusqu'à la
fermeture de l'onglet.

Trois gestes :

1. écrire `arreter()` : `clearInterval`, et remettre `minuterie` à `null` ;
2. l'appeler en tête de `surveiller()` ;
3. déclarer le nettoyage dans le constructeur, **au même endroit que la
   ressource qu'il libère** :

```ts
inject(DestroyRef).onDestroy(() => this.arreter());
```

Un nettoyage écrit à cinquante lignes de distance est un nettoyage qu'on
oubliera de mettre à jour. C'est la même idée que la fonction `onCleanup` que
reçoit un `effect` : la libération est déclarée à côté de l'acquisition.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run test:structure` : vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] Les badges se mettent à jour sans intervention
- [ ] Aucun `detectChanges()` ni `NgZone` dans le code
- [ ] Après plusieurs changements de filtre, une seule rafale de requêtes de
      stock toutes les quinze secondes (onglet Réseau)

## Bonus — Mesurer au Profiler

Ouvrez les **Angular DevTools**, onglet *Profiler*, et enregistrez trente
secondes d'inactivité sur la page catalogue.

- Combien de cycles de détection sont déclenchés par les rafraîchissements de
  stock ?
- Quels composants sont revérifiés : uniquement les badges, ou toute la grille ?
- Que se passerait-il si `quantite()` renvoyait un nouvel objet à chaque appel
  au lieu d'un nombre ?

Gardez ces chiffres : on les comparera au TP 10.

## Bonus — `linkedSignal` sur la quantité

Lisez `libs/catalogue/ui/src/lib/quantite-choisie.bonus.spec.ts`. La quantité
qu'on s'apprête à commander est un état **local** (l'utilisateur la modifie)
mais **dérivé** du stock (elle ne peut pas le dépasser).

- Un `computed` ne s'écrit pas.
- Un `signal` corrigé par un `effect` est exactement l'effet « qui fait `set()`
  sur un autre signal » déconseillé à l'étape 2.
- `linkedSignal` s'écrit, et se recalcule quand sa source change **en
  connaissant sa valeur précédente** : le choix de l'utilisateur est gardé tant
  que le stock le permet.

Les quatre tests sont verts dès l'ouverture. Remplacez `precedent?.value ?? 1`
par `1` dans le composant du test : deux tests passent au rouge. Pourquoi
exactement ces deux-là ?
