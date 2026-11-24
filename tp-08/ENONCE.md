# TP 8 — Sécuriser le back-office

**Durée** 50 min · **Rouges au départ** 26, dont **20 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Maison&Co a besoin d'un espace d'administration : chiffre d'affaires, commandes,
ruptures de stock. Réservé aux administrateurs : un client connecté ne doit pas
y accéder, un visiteur anonyme non plus.

La vraie question n'est pas « comment cacher le menu », c'est **« comment faire
en sorte que le code du back-office ne soit même pas téléchargé par un
visiteur »**.

Comptes de test : `client@maison.co` / `client` et `admin@maison.co` / `admin`.

## Ce qui vous est fourni

Lisez-le avant d'écrire : c'est la forme cible.

| Fichier | Rôle |
| --- | --- |
| `libs/auth/domaine/.../session.ts` | Le domaine de la session : marge d'expiration, durée → instant, rôle inconnu → `client` (7 tests verts) |
| `libs/admin/feature/.../admin.page.ts` | Le tableau de bord : `httpResource` avec la garde `hasValue()`, bloc différé en `@defer` |
| `apps/boutique/.../app.ts` | La barre de connexion dans l'en-tête |
| `apps/boutique/.../app.config.ts` | `fournirStrategiesLivraison()` déjà enregistré |

La page admin est écrite, mais personne ne peut encore l'atteindre : c'est le
travail des trois étapes.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 26 rouges au départ, tous verts à la fin
npx nx run-many -t lint      # doit rester vert en permanence
npm run test:structure       # vert
```

**Pourquoi 26 rouges et pas 20 ?** Six tests *bonus* utilisent le store et
l'intercepteur que vous allez écrire : ils passent seuls au vert, vous n'avez
rien à y écrire. Ça se lit dans le compteur :

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 26 |
| l'étape 1 | 15 (9 écrits + 2 bonus qui passent seuls) |
| l'étape 2 | 5 (6 écrits + 4 bonus qui passent seuls) |
| l'étape 3 | 0 |

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.
Les fonctions à écrire contiennent un `TODO TP 8` et lèvent une erreur
explicite tant qu'elles ne sont pas écrites.

## Étape 1 — Le store de session (9 tests)

`libs/auth/data-access/src/lib/session.store.ts`

Trois méthodes : `jetonValide`, `connexion`, `rafraichir`. Elles s'appuient sur
`estUtilisable` et `versSession`, déjà écrites dans le domaine.

Le jeton vit **en mémoire**, pas dans `localStorage` : un script tiers peut lire
le stockage du navigateur. Le prix à payer est qu'un rechargement de page
déconnecte. C'est un compromis, pas une vérité (voir le bonus sur le stockage).

`connexion` et `rafraichir` renvoient un booléen et **ne rejettent jamais** : un
échec d'identifiants est un état d'interface, pas une exception. C'est la même
discipline que `charger()` au TP 2.

Un test à lire attentivement : « ne rafraîchit pas sans session ». Sans garde,
on envoie une requête de rafraîchissement avec `undefined` — et on récolte un
401.

## Étape 2 — L'intercepteur (6 tests)

`libs/auth/data-access/src/lib/auth.interceptor.ts`

```ts
export const authInterceptor: HttpInterceptorFn = (requete, suivant) => { … };
```

Trois conditions avant d'ajouter le jeton, chacune couverte par un test :

1. **La requête va-t-elle vers notre API ?** Un appel vers un service tiers ne
   doit jamais emporter le jeton. C'est le test le plus important du lot : une
   fuite de jeton vers un domaine externe est une vraie faille.
2. **Est-ce une route d'authentification ?** Sinon un jeton expiré ferait
   échouer son propre rafraîchissement.
3. **Y a-t-il un jeton valide ?** `jetonValide()` renvoie `null` si absent ou
   périmé.

Puis branchez-le dans `apps/boutique/src/app/app.config.ts` — un intercepteur
non branché ne fait rien :

```ts
provideHttpClient(withInterceptors([authInterceptor])),
```

## Étape 3 — Le guard, et pourquoi `canMatch` (5 tests)

`libs/auth/data-access/src/lib/admin.guard.ts` puis `apps/boutique/src/app/app.routes.ts`

```ts
export const estAdmin: CanMatchFn = () => { … };
```

Un guard renvoie `true`, `false`, ou un `UrlTree` — qui vaut redirection.

**La décision du TP est le choix de `canMatch` plutôt que `canActivate` :**

| | `canActivate` | `canMatch` |
| --- | --- | --- |
| Moment | après le chargement du bundle | **avant** |
| Le visiteur télécharge le code admin | oui | **non** |
| Permet deux composants pour un même chemin | non | oui |

Avec `canActivate`, le code de votre back-office atterrit chez tous vos
visiteurs. Ils ne le voient pas, mais ils l'ont — et un curieux peut le lire.

Déclarez deux routes dans `app.routes.ts` :

```ts
{
  path: 'admin',
  canMatch: [estAdmin],
  loadChildren: () => import('@maison/admin/feature').then((m) => m.ADMIN_ROUTES),
},
```

et **la cible de la redirection du guard**, `/connexion`. Sans route, la
redirection échoue (`NG04002`) et un visiteur qui ouvre `/admin` directement
tombe sur une page vide. La barre de connexion est dans l'en-tête : redirigez
vers la racine.

### La vérification qui compte

Lancez l'API et l'application **en développement** (jamais sur le build de
production : les noms de chunks y sont hachés, le filtre ne montrerait rien).

```bash
npm run api
npx nx serve boutique
```

1. Ouvrez l'onglet **Réseau**, videz-le, filtrez sur `admin.page`.
2. Sans être connecté, ouvrez `/admin` : vous arrivez sur le catalogue, formulaire
   de connexion visible, et **aucun** chunk `admin.page`.
3. Connectez-vous en client : même résultat.
4. Connectez-vous en admin, cliquez sur le lien « back-office » : le chunk
   apparaît et le tableau de bord s'affiche.

Deux précautions :

- **Naviguez avec les liens, ne rechargez pas** : le jeton est en mémoire, un
  rechargement vous déconnecte. C'est le compromis assumé de l'étape 1, pas un
  bug.
- Si vous filtrez sur `admin` seul, vous verrez une ligne `/admin` : c'est la
  **navigation du document** (le HTML de la page), pas le code du back-office.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] Aucun chunk `admin.page` téléchargé par un visiteur anonyme ni par un client
- [ ] Le jeton n'est jamais envoyé vers un domaine tiers
- [ ] Le jeton n'apparaît nulle part dans `localStorage`

## La frontière qu'on a dû ouvrir

`apps/boutique` importe désormais `auth/data-access` — pour le guard et
l'intercepteur. La règle l'interdisait : `type:app` ne pouvait atteindre que
`feature`, `ui` et `util`.

Elle a été assouplie, avec ce commentaire dans `eslint.config.mjs` :

```js
// La racine de composition fait exception : c'est elle qui câble les
// providers (intercepteurs, guards), et ceux-ci vivent en data-access.
// Troisième dérogation de la formation (après catalogue → panier et
// l'exception ciblée du TP 5, qu'elle absorbe) — à compter, pas à banaliser.
```

**C'est la troisième dérogation.** Les deux premières datent du TP 5 :
`catalogue → panier`, et l'exception ciblée `allow: ['@maison/livraison/data-access']`
qui laissait la racine enregistrer les stratégies de livraison. Celle-ci
disparaît : la nouvelle règle ouvre **toute** la couche data-access à la racine,
l'exception étroite n'a plus d'objet. Regardez le commentaire au-dessus de
`allow: []` : une dérogation ciblée est devenue large.

Deux questions à se poser en équipe :

1. Aurait-on pu l'éviter ? Oui : en exposant `fournirAuth()` depuis une lib
   `auth/feature` qui masque la data-access. Est-ce que ça vaut une
   bibliothèque de plus, pour une dépendance qui existe de toute façon ?
2. À partir de combien de dérogations la matrice ne protège-t-elle plus rien ?

Il n'y a pas de bonne réponse universelle. Il y a une équipe qui les compte, et
une qui ne les compte pas.

## Bonus — Le rafraîchissement automatique du jeton

Lisez `auth.refresh.bonus.spec.ts`. Un intercepteur capte les 401, rafraîchit,
et rejoue la requête avec le nouveau jeton. Le piège : **dix requêtes en 401
simultanées ne doivent déclencher qu'un seul rafraîchissement**. La solution
tient en une promesse mémorisée (`??=`), et un test le vérifie.

Pour le voir en direct, lancez l'API avec un jeton court :

```bash
cd api && npm run start:jeton-court     # jeton valable 10 secondes
```

Connectez-vous, attendez dix secondes, rechargez les indicateurs : sans reprise,
l'intercepteur n'envoie plus le jeton et l'API répond 401.

Ces tests sont verts dès que l'étape 2 est écrite. Pour aller plus loin, sortez
l'intercepteur de reprise du test, placez-le dans `auth.interceptor.ts` et
branchez-le dans `app.config.ts`.

## Bonus — Le stockage du jeton : comparer les quatre options

Lisez `session.store.bonus.spec.ts` : il fige deux conséquences du choix « en
mémoire » — rien n'est écrit dans `localStorage` ni `sessionStorage`, et un
rechargement déconnecte. Ces tests sont verts dès que l'étape 1 est écrite.

| | Lisible par un script de la page | Survit au rechargement | Part tout seul avec les requêtes |
| --- | --- | --- | --- |
| `localStorage` | oui | oui, et à la fermeture | non |
| `sessionStorage` | oui | oui, pas à la fermeture de l'onglet | non |
| Mémoire | non, pas depuis le stockage | non | non |
| Cookie `HttpOnly` posé par le serveur | non | oui | **oui** (donc exposé au CSRF : `SameSite`) |

Aucune option ne résiste à un XSS qui s'exécute *dans* la page : il peut appeler
l'API avec la session en cours. Les options diffèrent par ce qu'il peut
**exfiltrer** et **conserver**. Laquelle choisiriez-vous pour votre projet, et
qu'est-ce qui vous ferait changer d'avis ?
