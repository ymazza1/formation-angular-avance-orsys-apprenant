# TP 6 — Le tunnel de commande en Signal Forms

**Durée** 50 min · **Rouges au départ** 13, dont **11 à écrire** · tous les autres tests sont déjà verts

## Le contexte

Le panier fonctionne. Il faut maintenant pouvoir commander : coordonnées,
adresse, mode de livraison, CGV.

C'est l'occasion d'utiliser **Signal Forms**, stable depuis Angular 22. Le
modèle de données est un simple `signal`, la validation vit dans un schéma
séparé, et l'état du formulaire est exposé en signaux.

## Ce qui vous est fourni

Lisez-le avant d'écrire.

| Fichier | Rôle |
| --- | --- |
| `libs/commande/domaine/.../commande.ts` | Le type `Commande`, `FORMAT_CODE_POSTAL`, et les règles de livraison : `accepteEnPointRelais`, `modesDisponibles`, `modeCorrige` (11 tests verts) |
| `libs/commande/feature/.../commande.page.ts` | La page : le modèle `signal<Commande>`, `form(modele, schemaCommande(base))`, les champs nom, adresse, code postal, ville, mode et CGV, la soumission. Il manque le champ email et la garde du bouton |
| `libs/commande/feature/.../commande.schema.ts` | Le schéma, **vide** : le formulaire accepte tout |
| `libs/catalogue/feature/.../catalogue.page.ts` | Le lien **Commander** dans le récapitulatif du panier, vers la route `/commande` déjà déclarée |

Lancez l'application, ajoutez un article, cliquez sur **Commander** : la page
s'affiche, mais le bouton « Valider la commande » est actif sur un formulaire
vide. Les trois étapes le rendent vrai.

## Deux nouvelles bibliothèques

```
libs/commande/domaine/    type:domaine,  domaine:commande
libs/commande/feature/    type:feature,  domaine:commande
```

La règle de frontières autorise `domaine:commande` à atteindre `panier`,
`catalogue` et `livraison`, jamais l'inverse.

**Les règles de livraison sont dans le domaine, pas dans le formulaire.** La
même fonction `modesDisponibles` servira à refuser une commande arrivée par une
autre voie (une API publique, un import de fichier). Le schéma de cet exercice
ne valide que la saisie.

## Comment savoir si vous avez fini

```bash
npx nx run-many -t test      # 13 rouges au départ, tous verts à la fin
npm run test:structure       # vert, et doit le rester
npx nx run-many -t lint      # vert
```

**Pourquoi 13 rouges et pas 11 ?** Les deux tests du bonus « les erreurs comme
objets » interrogent votre validation asynchrone : ils passent seuls à
l'étape 2. Vous n'avez rien à y écrire.

| Après… | Rouges restants |
| --- | --- |
| l'ouverture du projet | 13 |
| l'étape 1 | 6 |
| l'étape 2 | 3 (1 écrit + 2 qui passent seuls) |
| l'étape 3 | 0 |

Les fichiers `*.spec.ts` ne sont pas à modifier : ce sont vos spécifications.

## Étape 1 — Le schéma de validation (7 tests)

`libs/commande/feature/src/lib/commande.schema.ts`

```ts
export function schemaCommande(base: string) {
  return schema<Commande>((c) => {
    required(c.email, { message: 'Renseignez votre email' });
    email(c.email, { message: 'Cet email ne semble pas valide' });
    // …
  });
}
```

Les opérateurs viennent de `@angular/forms/signals` : `required`, `email`,
`pattern`, `validate`. Les messages exacts sont dans `commande.schema.spec.ts`.
Le format du code postal est déjà dans le domaine (`FORMAT_CODE_POSTAL`) :
importez-le, ne le recopiez pas.

Pour les CGV, `required` ne suffit pas : un booléen `false` n'est pas « vide ».
Il faut `validate` et renvoyer une erreur, qui est un simple objet :

```ts
validate(c.accepteCgv, ({ value }) =>
  value() ? undefined : { kind: 'cgv', message: 'Vous devez accepter les CGV' },
);
```

**Regardez où vit ce schéma** : dans son propre fichier, pas dans le composant.
C'est ce qui permet au spec de le tester **sans monter d'interface, sans DOM et
sans clic**. C'est l'apport principal de Signal Forms sur les Reactive Forms, où
la validation finit mêlée à la construction du `FormGroup`.

## Étape 2 — La validation asynchrone et l'état à trois valeurs (1 test)

Toujours dans le schéma :

```ts
validateHttp(c.codePostal, {
  request: ({ value }) =>
    FORMAT_CODE_POSTAL.test(value()) ? `${base}/validation/code-postal/${value()}` : undefined,
  onSuccess: (reponse: ReponseCodePostal) =>
    reponse.valide ? undefined : { kind: 'zone', message: 'Nous ne livrons pas encore dans cette zone' },
  onError: () => undefined,
});
```

`ReponseCodePostal` est à déclarer dans le fichier : `{ valide: boolean; ville?: string }`.

Trois choses à remarquer :

1. **`request` renvoie `undefined`** tant que le format n'est pas bon. Inutile
   d'interroger le serveur pour « 4 » : c'est le même réflexe qu'au TP 3, où on
   n'interrogeait pas l'API pour une recherche trop courte.
2. **`onError` renvoie `undefined`** : si le service de vérification est en
   panne, on ne bloque pas la commande. Décision commerciale, à assumer.
3. Sous le capot, c'est un `httpResource`, celui du TP 7. La requête est
   relancée quand la valeur change, et la précédente est annulée.

### Le test qui surprend

```ts
it('reste en attente tant que la zone de livraison n est pas vérifiée', () => {
  expect(champs.codePostal().pending()).toBe(true);
  expect(champs().valid()).toBe(false);
  expect(champs().invalid()).toBe(false);
});
```

Un formulaire complet dont une validation asynchrone est en cours n'est **ni
valide ni invalide**. Trois états, pas deux. Retenez-le pour l'étape 3 : c'est
lui qui décide de la garde du bouton.

## Étape 3 — Le formulaire (3 tests)

`libs/commande/feature/src/lib/commande.page.ts`

Deux `TODO` dans le template. La liaison passe par la directive `FormField`,
déjà importée ; le champ code postal, fourni, montre la forme.

```html
<label>
  Email
  <input type="email" [formField]="commande.email" />
</label>
@if (commande.email().touched()) {
  @for (erreur of commande.email().errors(); track $index) {
    <p role="alert">{{ erreur.message }}</p>
  }
}
```

Trois niveaux de lecture à distinguer :

| Écriture | Ce que c'est |
| --- | --- |
| `commande.email` | le **champ**, à passer à `[formField]` |
| `commande.email()` | son **état** : `value`, `errors`, `touched`, `pending`… |
| `commande()` | l'état du **formulaire entier** |

N'affichez les erreurs qu'après `touched()` : personne n'aime un formulaire qui
crie avant qu'on ait tapé quoi que ce soit.

Reste le bouton. `[disabled]="commande().invalid()"` paraît naturel, et il est
faux : pendant la vérification du code postal, le formulaire n'est pas invalide,
et le bouton s'active. Le test « garde le bouton désactivé tant que la zone de
livraison est en vérification » le refuse. Gardez le bouton sur `valid()`, et
sur l'envoi en cours :

```html
<button type="button" [disabled]="!commande().valid() || envoi()" (click)="valider()">
```

### Dans le navigateur

Ajoutez un article, puis **Commander** :

- laissez l'email vide, sortez du champ : le message apparaît ;
- tapez `12345` en code postal : « zone non desservie » après un instant ;
- tapez `44840` : l'erreur disparaît ;
- décochez les CGV : le bouton se désactive.

Codes postaux desservis pour tester : `44000`, `44840`, `75001`, `69001`,
`33000`, `59000`.

## Vérification finale

- [ ] `npx nx run-many -t test` : tout vert
- [ ] `npm run test:structure` : vert
- [ ] `npx nx run-many -t lint` : vert
- [ ] Aucune règle métier dupliquée entre le domaine et le schéma
- [ ] Les erreurs ne s'affichent qu'après `touched()`
- [ ] Le bouton reste désactivé pendant « Vérification de la zone de livraison… »

## Les deux questions de fin

1. Le bouton sur `invalid()` laissait passer un formulaire en attente. Qu'aurait
   fait `submit()` d'une commande dont la zone n'est pas encore vérifiée ?
2. Comparez ce fichier avec ce qu'aurait donné un `FormGroup` typé : où serait la
   validation, et comment la testeriez-vous sans monter le composant ?

## Bonus — Corriger un mode devenu impossible

Lisez le constructeur de la page :

```ts
effect(() => {
  const lignes = this.panier.lignes();
  this.modele.update((commande) => ({
    ...commande,
    mode: modeCorrige(lignes, commande.mode),
  }));
});
```

Cas réel : l'utilisateur choisit « point relais », puis ajoute un canapé à son
panier. Sans correction, on enregistre une commande impossible à livrer.

**Troisième `effect` légitime de la formation**, et d'une autre nature que celui
du panier : il ne synchronise pas un système extérieur, il **répare un état
saisi par l'utilisateur** quand le contexte change sous lui. Il écrit dans un
signal, ce que le TP 5 déconseillait : c'est l'exception qui confirme la règle.

La question à se poser : pourrait-on en faire un `computed` ? Non, parce que le
mode est une donnée saisie, pas une donnée dérivée. On ne peut pas la
recalculer, seulement la corriger quand elle devient invalide.

`commande.page.bonus.spec.ts` le verrouille (2 tests verts). Supprimez l'effet :
« ramène au domicile un point relais devenu impossible » passe au rouge.
Remettez-le. Dans le navigateur : choisissez « En point relais », revenez au
catalogue, ajoutez un canapé, revenez à la commande.

## Bonus — Les erreurs comme objets `{ kind, message }`

Une erreur de Signal Forms n'est pas une chaîne : son `kind` dit d'où elle vient,
son `message` ce qu'on affiche. Lisez `commande.schema.bonus.spec.ts` : il
répond à la requête de vérification avec `HttpTestingController`, une fois
« zone refusée », une fois en panne (503).

- une zone refusée donne `{ kind: 'zone', message: … }`, et le formulaire est invalide ;
- une panne ne donne **aucune** erreur, et le formulaire est valide : c'est
  votre `onError: () => undefined`.

Pour aller plus loin : n'affichez sous le code postal que les erreurs de `kind`
`'zone'` quand le format est bon, et rendez la ville obligatoire seulement pour
une livraison à domicile (`applyWhen`).
