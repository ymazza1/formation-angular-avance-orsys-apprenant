import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Produit } from '@maison/catalogue/domaine';
import { coutLivraison } from '@maison/livraison/domaine';
import { STRATEGIES_LIVRAISON } from '@maison/livraison/data-access';
import {
  ajouter,
  changerQuantite,
  nbArticles,
  Panier,
  PANIER_VIDE,
  remise,
  retirer,
  sousTotal,
  versLignesLivrables,
} from '@maison/panier/domaine';
import { API_URL } from '@maison/partage/util';
import { firstValueFrom } from 'rxjs';

export const CLE_PERSISTANCE = 'maison-et-co.panier';

interface ReponsePromotion {
  valide: boolean;
  remisePourcent?: number;
}

/**
 * Store du panier.
 *
 * Trois règles, et elles suffisent :
 *
 *   1. un seul signal en écriture, privé — tout le reste est dérivé ;
 *   2. aucune règle métier ici : le store appelle le domaine ;
 *   3. un seul effet, et il ne calcule rien — il persiste.
 *
 * La chaîne de dérivation va de `lignes` à `total` sans qu'aucun montant
 * intermédiaire ne soit stocké. Un total stocké finit toujours par diverger de
 * son détail.
 */
@Injectable({ providedIn: 'root' })
export class PanierStore {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  private readonly strategies = inject(STRATEGIES_LIVRAISON);

  private readonly _lignes = signal<Panier>(PANIER_VIDE);
  private readonly _codePromo = signal<string | null>(null);
  private readonly _remisePourcent = signal<number | null>(null);
  private readonly _erreurPromo = signal<string | null>(null);

  readonly lignes = this._lignes.asReadonly();
  readonly codePromo = this._codePromo.asReadonly();
  readonly erreurPromo = this._erreurPromo.asReadonly();

  readonly nbArticles = computed(() => nbArticles(this._lignes()));
  readonly estVide = computed(() => this._lignes().length === 0);
  // TODO TP 5 — étape 3 : la chaîne de dérivation. Ces quatre montants valent 0
  // en attendant : le récapitulatif s'affiche, mais il ment.
  readonly sousTotal = computed<number>(() => 0);

  /** Un panier vide ne coûte rien à livrer — attention au cas limite. */
  readonly fraisLivraison = computed<number>(() => 0);

  readonly remise = computed<number>(() => 0);

  readonly total = computed<number>(() => 0);

  constructor() {
    this.restaurer();

    /**
     * Le seul effet du store, et il est légitime : il synchronise un système
     * extérieur (le stockage du navigateur) avec l'état réactif. Il ne calcule
     * rien et n'écrit dans aucun signal.
     */
    effect(() => {
      const contenu = JSON.stringify(this._lignes());
      try {
        localStorage.setItem(CLE_PERSISTANCE, contenu);
      } catch {
        // stockage plein ou navigation privée : le panier reste en mémoire
      }
    });
  }

  // TODO TP 5 — étape 2 : chaque commande délègue au domaine, et ne contient
  // aucune règle métier. Elles ne font encore rien.

  ajouter(produit: Produit, quantite = 1): void {
    return;
  }

  retirer(produitId: string): void {
    return;
  }

  changerQuantite(produitId: string, quantite: number): void {
    return;
  }

  vider(): void {
    return;
  }

  async appliquerCodePromo(code: string): Promise<void> {
    this._erreurPromo.set(null);
    try {
      const reponse = await firstValueFrom(
        this.http.get<ReponsePromotion>(`${this.base}/promotions/${code}`),
      );
      if (!reponse.valide) {
        this._erreurPromo.set('code_invalide');
        return;
      }
      this._codePromo.set(code);
      this._remisePourcent.set(reponse.remisePourcent ?? null);
    } catch {
      this._erreurPromo.set('verification_impossible');
    }
  }

  retirerCodePromo(): void {
    this._codePromo.set(null);
    this._remisePourcent.set(null);
    this._erreurPromo.set(null);
  }

  private restaurer(): void {
    try {
      const brut = localStorage.getItem(CLE_PERSISTANCE);
      if (brut) this._lignes.set(JSON.parse(brut) as Panier);
    } catch {
      // contenu illisible : on repart d'un panier vide plutôt que de planter
    }
  }
}

function arrondirCentimes(montant: number): number {
  return Math.round(montant * 100) / 100;
}
