# TP 7 — Le catalogue en signal-first

**Durée** 40 min · **Rouges au départ** 13, dont **11 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Souvenez-vous de la question laissée ouverte au TP 3 : toute la mécanique du
pipeline (debounce, annulation, reprise, états de chargement) existe pour une
seule chose, afficher une liste de produits qui correspond aux filtres courants.

On va en remplacer l'essentiel par `httpResource`, stable depuis Angular 22.

**Et on ne touchera à aucun composant.** C'est la troisième implémentation de
la même façade depuis le TP 2 ; sa surface publique n'a jamais bougé.

## Ce qui vous est fourni

| Fichier | Rôle |
| --- | --- |
| `libs/catalogue/data-access/.../catalogue.facade.ts` | La version RxJS du TP 3, **qui fonctionne**. C'est le seul fichier à réécrire |
| `catalogue.facade.spec.ts` | Les 11 tests de la version signal-first : elle charge sans qu'on le lui demande, et le temps s'y écrit avec `TestBed.tick()` |
| `catalogue.api.ts`, `produit.dto.ts` | `versParams` et `versProduit`, écrits au TP 2, réutilisés tels quels |

Lancez l'application : tout marche. Les tests sont rouges parce qu'ils décrivent
une autre implémentation, pas parce que celle-ci est fausse.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 13 rouges au départ, tous verts à la fin
npm run test:structure       # vert, et doit le rester
npx nx run-many -t lint      # vert
git diff --stat              # un seul fichier applicatif modifié
```

**Pourquoi 13 rouges et pas 11 ?** Les deux tests du bonus « ce qu'on garde, ce
qu'on perd » constatent le comportement de la ressource : ils passent seuls à
l'étape 1.

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 13 |
| l'étape 1 | 3 (8 écrits + 2 qui passent seuls) |
| l'étape 2 | 1 |
| l'étape 3 | 0 |

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.

## Étape 1 — La ressource (8 tests)

`libs/catalogue/data-access/src/lib/catalogue.facade.ts`

Avant de coder, faites la correspondance à l'oral :

| Dans le pipeline RxJS | Dans la ressource |
| --- | --- |
| `switchMap` | annulation automatique quand le paramètre change |
| `startWith({ chargement: true })` | `isLoading` |
| `catchError` | `error` |
| `map(versProduit)` | option `parse` |
| `toSignal` | la ressource **est** un signal |
| `retry` | **rien** — voir le bonus |

Puis remplacez le `Subject`, le pipeline et `etat` par une ressource :

```ts
private readonly base = inject(API_URL);

private readonly page = httpResource<PageProduits>(
  () => ({ url: `${this.base}/produits`, params: versParams(this._filtres()) }),
  {
    defaultValue: PAGE_VIDE,
    parse: (brut) => {
      const dto = brut as PageDto<ProduitDto>;
      return { items: dto.items.map(versProduit), total: dto.total, facettes: dto.facettes };
    },
  },
);
```

Deux choses à comprendre :

**La fonction de requête est réactive.** Elle lit un signal ; chaque fois que
ce signal change, la requête repart et la précédente est annulée. Personne
n'appelle « charger » : c'est la lecture qui crée la dépendance, comme dans un
`computed`.

**`parse` est le mapping.** Le DTO du serveur devient un objet de domaine avant
même d'entrer dans la ressource.

Il reste à rebrancher la surface publique, sans la changer :

- `produits`, `total`, `facettes` : des `computed` qui lisent `this.page.value()` ;
- `enChargement` : `this.page.isLoading` ;
- `erreur` : `'catalogue_indisponible'` quand `this.page.error()` est renseigné, sinon `null` ;
- `rafraichir()` : `this.page.reload()` ;
- `modifier()` et `reinitialiser()` : ils n'appellent plus `rafraichir()`.
  Changer le signal suffit.

Gardez `DELAI_FRAPPE_MS` exporté et `memesFiltres` en bas du fichier : l'étape 2
en a besoin.

## Étape 2 — Le debounce reste en RxJS (2 tests)

Les deux tests qui restent rouges sur les filtres disent la même chose : la
ressource part à chaque frappe, et même pour une seule lettre.

```ts
private readonly filtresApaises = toSignal(
  toObservable(this._filtres).pipe(
    filter((f) => rechercheExploitable(f.recherche)),
    debounceTime(DELAI_FRAPPE_MS),
    distinctUntilChanged(memesFiltres),
  ),
  { initialValue: FILTRES_VIDES },
);
```

La ressource lit désormais `this.filtresApaises()` au lieu de `this._filtres()`.

C'est le seul morceau de pipeline qui survit, et c'est volontaire. Une ressource
réagit à un **changement de paramètre**. Elle ne sait pas attendre que
l'utilisateur ait fini de taper. **Le temps reste le domaine de RxJS.**

`toObservable` est ici à sa place : on part d'un signal d'état pour construire un
flux temporel. C'est l'inverse du TP 3, où on modélisait une suite de demandes.

Lisez le test « ne part qu une fois pour une frappe rapide » : il laisse passer
un `TestBed.tick()` entre deux touches, comme le navigateur laisse passer un
rendu. Sans cela, la ressource ne lirait que la dernière valeur et le test
passerait sans debounce.

## Étape 3 — Le piège de `value()` (1 test)

Le dernier rouge :

> expose une erreur sans casser la façade

**`value()` lève une exception quand la ressource est en erreur.** Elle ne
retombe pas sur `defaultValue`. C'est contre-intuitif, et ça ne se voit qu'en
situation d'échec réseau, donc jamais pendant le développement.

**Montrez-le avant de le corriger.** Application lancée, coupez l'API
(`Ctrl+C` dans son terminal) et tapez une recherche : le message d'erreur ne
s'affiche pas, et la console montre `ResourceValueError: Resource is currently
in an error state`. Relancez l'API.

La garde :

```ts
private readonly pageSure = computed<PageProduits>(() =>
  this.page.hasValue() ? this.page.value() : PAGE_VIDE,
);

readonly produits = computed(() => this.pageSure().items);
readonly total = computed(() => this.pageSure().total);
readonly facettes = computed(() => this.pageSure().facettes);
```

Une seule dérivation protège les trois autres. Coupez l'API de nouveau : « Le
catalogue est momentanément indisponible » s'affiche, avec « Réessayer ».

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run test:structure` : vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] `git diff --stat` ne montre qu'un fichier applicatif
- [ ] Dans le navigateur : taper vite ne déclenche qu'une requête
- [ ] API coupée : le message d'erreur s'affiche, aucune exception en console

## Les deux questions de fin

1. Le test « frappe rapide » passait sans debounce tant qu'il n'y avait pas de
   `TestBed.tick()` entre deux touches. Qu'est-ce que ça dit de la façon dont
   une ressource lit ses paramètres ?
2. `value()` qui lève : préférez-vous une API qui lève, ou une API qui renvoie
   silencieusement une valeur par défaut ? Qu'est-ce que chacune cache ?

## Bonus — Ce qu'on garde, ce qu'on perd

Lisez `catalogue.facade.bonus.spec.ts` (2 tests, verts dès l'étape 1) :

- **on garde l'annulation** : quand les filtres changent, la requête en cours
  est annulée (`cancelled`), pas seulement ignorée ;
- **on perd la reprise** : la version RxJS refaisait deux tentatives avec un
  délai croissant. La ressource abandonne à la première erreur.

Trois réponses possibles, à discuter :

1. **S'en passer.** Le bouton « Réessayer », branché sur `reload()`, suffit
   souvent, et il est plus honnête vis-à-vis de l'utilisateur.
2. **Un intercepteur HTTP** qui gère la reprise pour toute l'application : c'est
   souvent sa vraie place (TP 8).
3. **`rxResource`** : mêmes signaux en sortie, mais le chargement est un
   Observable, donc on garde un `pipe` complet, `retry` compris. Essayez : le
   test « ne réessaie pas une requête en échec » passe au rouge. C'est le but.
   Revenez ensuite à `httpResource`.

« La nouvelle API est plus simple » n'est une bonne réponse que si on sait ce
qu'on a abandonné.

## Bonus — Le bilan

```bash
git diff --stat
```

Un seul fichier applicatif modifié. Aucun composant, aucun template.

Comparez les deux versions côte à côte, et remplissez le tableau en comptant
dans votre fichier :

| | TP 3 (RxJS) | TP 7 (ressource) |
| --- | --- | --- |
| Opérateurs RxJS importés | | |
| Gestion du chargement | `startWith` manuel | `isLoading` |
| Gestion de l'erreur | `catchError` | `error` |
| Reprise automatique | oui | **non** |
| Annulation | `switchMap` | intégrée |
| Temps (debounce) | RxJS | RxJS |

Pour aller plus loin : `StockStore` (TP 4) est un autre candidat. Qu'est-ce qui
remplacerait le `setInterval` et le `DestroyRef` ?
