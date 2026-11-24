# TP 9 — Sécuriser Maison&Co par les tests

**Durée** 40 min · **Rouges au départ** 8, tous à écrire · **plus 1 mutant survivant** à tuer

## Le contexte

Il reste une chose à faire, laissée ouverte au TP 5 : **envoyer la commande**.
Et une question à trancher : le stock a pu tomber à zéro pendant que le produit
était au panier.

C'est l'occasion de travailler sérieusement les tests : d'abord en écrivant du
code piloté par eux, puis en vérifiant que la suite existante vaut quelque
chose.

Comptes de test : `client@maison.co` / `client` et `admin@maison.co` / `admin`.
Le `POST /api/commandes` exige d'être connecté.

## Ce qui vous est fourni

Lisez-le avant d'écrire : c'est la forme cible.

| Fichier | Rôle |
| --- | --- |
| `libs/commande/data-access/.../commande.store.ts` | Le type `ResultatCommande`, les signaux du store, et le **chemin du succès** de `envoyer` (requête et corps) |
| `libs/commande/feature/.../commande.page.ts` | La page branchée sur le store : `valider()` appelle `envoyer`, un message par statut |
| `tools/mutants/chasse.mjs` | La chasse aux mutants (`npm run mutants`) |

Le point de départ **fonctionne à moitié** : connecté, une commande part et sa
référence s'affiche. Mais le panier reste plein, et la moindre erreur du
serveur remonte en exception dans la console.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 8 rouges au départ, tous dans commande-data-access
npm run mutants              # 7 tués sur 8 au départ, 8 sur 8 à la fin
npx nx run-many -t lint      # doit rester vert en permanence
```

| Après… | Rouges restants | Mutants tués |
| --- | --- | --- |
| l'ouverture du projet | 8 | 7 / 8 |
| l'étape 1 | 8 (on lit, on n'écrit pas) | 7 / 8 |
| l'étape 2 | 0 | 7 / 8 |
| l'étape 3 | 0 | 8 / 8 |

Les fichiers `*.spec.ts` ne sont pas à modifier, **sauf à l'étape 3** : c'est
vous qui écrivez le test qui manque. Les fonctions à écrire contiennent un
`TODO TP 9`.

Au départ, « refuse un panier vide sans appeler l API » échoue après 5
secondes (« Test timed out ») : la requête part, le test n'y répond pas, et la
promesse attend. C'est normal.

## Étape 1 — Lire les tests avant d'écrire le code

`libs/commande/data-access/src/lib/commande.store.spec.ts`

Onze tests, déjà écrits. Trois passent déjà (le chemin du succès est fourni).
Lisez-les **tous** avant de toucher au code, et répondez à ces questions à
partir des seuls tests :

1. Que se passe-t-il quand le panier est vide ?
2. Qu'envoie-t-on exactement au serveur pour chaque ligne ?
3. Dans quels cas le panier est-il vidé ?
4. Combien d'issues distinctes `envoyer` peut-elle avoir ?

Si vous savez répondre, les tests font leur travail : ils **spécifient**. C'est
le critère à retenir : un bon test se lit comme un cahier des charges.

## Étape 2 — Le store d'envoi (8 tests)

`libs/commande/data-access/src/lib/commande.store.ts`

```ts
export type ResultatCommande =
  | { statut: 'enregistree'; reference: string }
  | { statut: 'panier-vide' }
  | { statut: 'stock-insuffisant'; produitId: string }
  | { statut: 'non-authentifie' }
  | { statut: 'indisponible' };
```

Une **union discriminée**, pas un booléen. Chaque issue porte ce dont
l'interface a besoin pour réagir : le `409` transporte le produit fautif, donc
on peut afficher « L'étagère Kalix vient de partir en rupture » plutôt que
« Erreur ». Avec `{ succes: false }`, il faudrait un second champ pour savoir
quoi afficher, et rien n'obligerait à le remplir.

Complétez `envoyer` et écrivez `interpreter`. Trois points que les tests
verrouillent :

**Le panier n'est vidé qu'en cas de succès.** Perdre un panier de 1 200 € sur
une coupure réseau est pire que la coupure.

**`envoyer` ne rejette jamais.** Quatrième fois dans la formation : erreur
attendue égale état, pas exception. `interpreter` traduit `401`, `409` (avec
son `produitId`) et tout le reste.

**L'état d'envoi se termine toujours**, y compris après une erreur : sinon le
bouton reste sur « Envoi en cours… ».

Le corps de la requête est fourni, et il mérite d'être lu : il n'envoie que
`produitId` et `quantite`. Le serveur refait le calcul des prix ; un client qui
envoie ses propres montants est une invitation à la fraude.

## Étape 3 — La chasse aux mutants

```bash
npm run mutants
```

Le script introduit une à une de petites erreurs dans le domaine (un `>=`
devenu `>`, un `&&` devenu `||`), puis relance les tests :

- **mutant tué** : au moins un test a échoué. Le code est réellement couvert.
- **mutant survivant** : tous les tests passent malgré l'erreur. **C'est un
  trou.**

> Un test qui passe ne prouve rien tant qu'on n'a pas vérifié qu'il sait
> échouer.

Vous devriez obtenir **7 tués sur 8**. Un mutant survit.

1. Lisez le rapport : il donne le fichier, la ligne, et la mutation exacte.
2. Écrivez le test qui l'aurait attrapé, dans le fichier de spec du même
   dossier.
3. Relancez : 8 sur 8.

Indice : il concerne un seuil. Regardez les valeurs utilisées par les tests
existants : aucune ne tombe **exactement** dessus.

C'est un bug réel, pas un exercice artificiel : avec la mutation en place, un
client dont le panier fait exactement 500 € se voit facturer la livraison.

Pour aller plus vite : `node tools/mutants/chasse.mjs livraison` ne joue que
les mutants du projet `livraison-domaine`.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run mutants` : 8 sur 8
- [ ] Le test que vous avez ajouté échoue bien si vous remettez la mutation à la main
- [ ] `npx nx run-many -t lint` : vert
- [ ] Connecté, une commande part, sa référence s'affiche, le panier est vide ;
      API coupée, un message s'affiche et le panier reste plein

## Les questions de fin

1. La couverture de lignes de `strategies.ts` était déjà de 100 %. Qu'est-ce
   que ça valait ?
2. Faut-il viser 100 % de mutants tués ? À quel coût ?
3. Sur quel code cette technique vaut-elle l'effort ? (Indice : regardez dans
   quels projets sont les mutants.)

`tools/mutants/chasse.mjs` tient en une page : ouvrez-le. Pour un vrai projet,
voyez **Stryker**, qui fait la même chose en générant les mutations
automatiquement.

## Bonus — Ce qui se teste bien, et ce qui se teste mal

Regardez la suite complète (`npx nx run-many -t test`) et classez ce qui a été
testé depuis trois jours :

| Testé sans TestBed | Testé avec TestBed | Pas testé |
| --- | --- | --- |
| domaines (produit, panier, livraison, commande, session) | stores, guards, intercepteurs, composants de présentation | pages routées, templates complets |

**Ce n'est pas un oubli.** Les pages sont testées indirectement : leur logique
vit dans des façades et des domaines qui, eux, sont couverts. Un test de page
coûte cher à écrire, casse à chaque refonte visuelle, et attrape surtout des
erreurs que le compilateur voit déjà.

La question à se poser n'est pas « qu'est-ce qui n'est pas couvert ? » mais
**« qu'est-ce qui, si ça cassait, ne serait pas rattrapé ? »**. Exemple à
chercher : la place du message de confirmation dans le template de
`commande.page.ts`. Quel test le protège ?

## Bonus — Le temps d'exécution

```bash
npx nx run-many -t test --skip-nx-cache
```

Notez la durée totale, et celle de chaque projet.

Les domaines tournent en environnement `node`, sans plugin Angular : quelques
dizaines de millisecondes. Les libs Angular montent un DOM : quelques
centaines.

C'est la raison pratique de la règle posée au TP 1 : « le domaine n'importe
rien d'Angular ». Une suite de domaine rapide est une suite qu'on relance à
chaque sauvegarde.
