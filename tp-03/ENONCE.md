# TP 3 — RxJS dans la façade

**Durée** 50 min · **Rouges au départ** 8, tous à écrire · tous les autres tests sont déjà verts

## Le contexte

La façade du catalogue fonctionne, dans un bureau, avec une API locale et un
réseau parfait. On va la mettre en situation réelle : réseau lent, erreurs
intermittentes, utilisateur qui tape vite.

C'est le TP où l'on voit pourquoi `switchMap` n'est pas un détail de syntaxe.

## Ce qui vous est fourni

Lisez-le avant d'écrire : c'est la forme cible.

| Fichier | Rôle |
| --- | --- |
| `libs/catalogue/data-access/.../catalogue.api.ts` | L'API repassée en `Observable` : le `firstValueFrom` du TP 2 jetait la seule chose qui nous intéresse aujourd'hui, la possibilité d'annuler |
| `libs/catalogue/data-access/.../catalogue.facade.ts` | La façade **naïve** : la source `demandes` (un `Subject`), l'état `EtatCatalogue`, son exposition par `toSignal`, et un pipeline qui marche mal |
| en bas du même fichier | `DELAI_FRAPPE_MS`, `TENTATIVES` et `memesFiltres` |
| `libs/catalogue/domaine/.../filtres.ts` | `rechercheExploitable` : la règle « on n'interroge pas le serveur pour une seule lettre », écrite au TP 2 |

Vous ne modifiez que le pipeline, dans `catalogue.facade.ts`. La surface publique
de la façade ne change pas : **aucun composant n'est touché par ce TP**.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 8 rouges au départ, tous verts à la fin
npm run test:structure       # vert, et doit le rester
npx nx run-many -t lint      # vert
```

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 8 |
| l'étape 1 | 5 |
| l'étape 2 | 3 |
| l'étape 3 | 0 |

Les rouges sont tous dans `catalogue.facade.spec.ts`, qui n'est pas à modifier :
c'est votre spécification. Le temps y est virtualisé (`vi.useFakeTimers()`) :
300 ms de debounce ne coûtent rien à l'exécution.

## Étape 1 — Une seule requête pour une frappe

`libs/catalogue/data-access/src/lib/catalogue.facade.ts`

**D'abord, ne modifiez rien.** Coupez l'API et relancez-la en mode instable :

```bash
cd api
npm run start:instable     # 30 % de 503, 600 ms de latence
```

Dans un second terminal, `npx nx serve boutique`. Ouvrez l'onglet **Réseau**
des DevTools et tapez « canapé », lentement puis vite. Notez :

- combien de requêtes sont parties pour un seul mot ;
- dans quel ordre les réponses sont arrivées ;
- si l'affichage correspond toujours à la dernière frappe ;
- ce qui se passe après une 503 : cliquez sur « Réessayer », retapez.

Insistez jusqu'à voir **l'affichage incohérent** : un résultat de « can » qui
écrase celui de « canapé ». Avec 600 ms de latence, ça arrive en quelques essais.
Il faut l'avoir vu une fois : en production, ce bug se manifeste une fois sur
cinquante et personne n'arrive à le reproduire.

Puis ajoutez, en tête du pipeline, trois opérateurs dans cet ordre :

```ts
filter((f) => rechercheExploitable(f.recherche)),
debounceTime(DELAI_FRAPPE_MS),
distinctUntilChanged(memesFiltres),
```

- `rechercheExploitable` vient du **domaine** : ne réécrivez pas la règle ici.
- `memesFiltres` compare champ par champ. `JSON.stringify(a) === JSON.stringify(b)`
  marche aussi, et casse silencieusement le jour où l'ordre des clés change.

Retapez « canapé » : combien de requêtes, maintenant ?

## Étape 2 — Annuler au lieu d'ignorer

Remplacez `mergeMap` par `switchMap`. Un mot, et c'est tout le TP.

Dans l'onglet Réseau, les requêtes abandonnées apparaissent désormais
**`canceled`**. Le test « n affiche jamais le résultat d une recherche abandonnée »
montre quelque chose de plus fort qu'un filtrage : une requête annulée ne peut
même **plus délivrer sa réponse**. Ce n'est pas « on ignore le résultat », c'est
« le résultat n'existe pas ».

Deux questions à traiter en binôme :

1. Pourquoi `mergeMap` était-il un mauvais choix ici ? Et `concatMap` ?
2. Existe-t-il un endroit dans Maison&Co où `switchMap` serait au contraire
   dangereux ? (indice : le bouton « Valider la commande » du TP 6)

## Étape 3 — Survivre aux erreurs

Toujours dans le `switchMap`, sur la requête elle-même :

```ts
retry({ count: TENTATIVES, delay: (_, tentative) => timer(200 * 2 ** (tentative - 1)) }),
```

Lancez les tests : il reste **un** rouge, « survit à l erreur ». Le `catchError`
fourni est au niveau du flux principal : la première erreur le termine, et
`toSignal` garde pour toujours l'état d'erreur. C'est ce que vous avez vu à
l'étape 1, quand « Réessayer » ne faisait plus rien.

Déplacez-le **à l'intérieur** du `switchMap`, juste après le `map`. L'erreur ne
tue plus que la requête courante, et la demande suivante repart. La différence
tient en deux niveaux d'indentation.

Le délai croissant (200 ms, puis 400 ms) n'est pas cosmétique : réessayer trois
fois en 30 ms sur un serveur qui sature ne fait qu'aggraver la situation.

### La vérification dans le navigateur

Avec l'API toujours en mode instable :

- tapez vite : une seule requête part ;
- changez de pièce pendant une recherche : la précédente est `canceled` ;
- tombez sur une 503 : le message s'affiche, puis une nouvelle recherche repart
  normalement, sans rechargement.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run test:structure` : vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] Taper « canapé » en vitesse normale déclenche **une** requête
- [ ] Les requêtes abandonnées sont `canceled` dans l'onglet Réseau
- [ ] Après une erreur affichée, l'application se rétablit seule

## La question à garder pour le TP 7

Comptez les lignes du pipeline. Toute cette mécanique (debounce, annulation,
retry, états de chargement) existe pour une seule chose : afficher une liste de
produits qui correspond aux filtres courants. Au TP 7, on la remplacera par
`resource()`. Gardez une copie du fichier : la comparaison vaut le détour.

## Bonus — `toSignal` et l'exposition sans souscription

Relisez la déclaration de `etat` : aucun `subscribe`, aucun `unsubscribe`.
`toSignal` souscrit une fois, et se désabonne quand l'injecteur qui l'a créé est
détruit. `initialValue` existe parce qu'un signal a toujours une valeur, alors
qu'un `Observable` peut n'avoir encore rien émis.

Le test « la requête en cours est annulée quand l injecteur est détruit »
(`catalogue.facade.bonus.spec.ts`) le vérifie : il détruit le module de test
pendant une requête, et constate qu'elle est annulée. Ajoutez
`manualCleanup: true` aux options de `toSignal` : il passe au rouge. Retirez-le.

Pourquoi un `Subject` plutôt que `toObservable(this._filtres)` ? Parce qu'on
modélise une **suite de demandes dans le temps** (« Réessayer » renvoie les
mêmes filtres, et doit repartir), pas la valeur courante des filtres, qui est
déjà un signal.

## Bonus — Le garde-fou « aucune souscription manuelle »

`tools/structure/souscriptions.spec.ts` interdit tout `.subscribe(` dans le code
applicatif, et tout `Subject` public dans une façade. Cassez-le volontairement :
remplacez `toSignal` par un `subscribe` qui alimente un `signal`, lancez
`npm run test:structure`, lisez le message. Remettez `toSignal`.

Une souscription manuelle est une fuite en puissance : il faut se souvenir de se
désabonner, et personne ne s'en souvient six mois plus tard. Le test rend la
règle vérifiable ; les fichiers de test en sont exclus, y souscrire est légitime.
