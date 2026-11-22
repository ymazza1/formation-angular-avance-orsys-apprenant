# Angular avancé — TP (version apprenant)

Un dossier par TP, de `tp-00` à `tp-10`. Chaque dossier est un workspace Nx
autonome : on l'ouvre, on l'installe, on travaille dedans.

```bash
cd tp-03
npm install --legacy-peer-deps
npm run api              # terminal dédié
npx nx serve boutique
```

## Comment travailler un TP

1. Lire `ENONCE.md` en entier avant de taper quoi que ce soit.
2. Lancer les tests : `npx nx run-many -t test`. Le nombre de rouges annoncé en
   tête d'énoncé est celui que vous devez voir.
3. Faire passer les étapes **1, 2 et 3** au vert. Elles sont le TP.
4. Les sections `Bonus — …` sont déjà vertes : leur code est fourni. On les lit
   si on a le temps, on ne les écrit pas.

## Points à savoir

- `npm install` demande `--legacy-peer-deps` : c'est assumé, pas un accident.
- Les images produit renvoient des 404. L'API de démonstration ne sert pas de
  fichiers ; c'est sans conséquence sur les exercices.
- Le jeton de session vit en mémoire : recharger la page déconnecte. C'est le
  compromis assumé du TP 08, pas un bug.
- Chaque TP repart du corrigé du précédent. Prendre du retard sur un TP n'empêche
  pas de démarrer le suivant.
