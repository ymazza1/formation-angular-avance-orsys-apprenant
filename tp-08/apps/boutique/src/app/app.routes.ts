import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('@maison/catalogue/feature').then((m) => m.CATALOGUE_ROUTES),
  },
  {
    path: 'commande',
    loadChildren: () => import('@maison/commande/feature').then((m) => m.COMMANDE_ROUTES),
  },
  // TODO TP 8 — étape 3
  // 1. Déclarer la route /admin, protégée par le guard et chargée en lazy.
  // 2. Déclarer /connexion : c'est la cible de la redirection du guard. Sans
  //    elle, la redirection échoue (NG04002) et /admin ouvert directement laisse
  //    une page vide. La barre de connexion est dans l'en-tête : redirigez vers
  //    la racine.
];
