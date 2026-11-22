import { computed, inject, Injectable, signal } from '@angular/core';
import { appliquer, Filtres, FILTRES_VIDES, Produit } from '@maison/catalogue/domaine';
import { firstValueFrom } from 'rxjs';
import { CatalogueApi, Facettes, PAGE_VIDE, PageProduits } from './catalogue.api';

/**
 * Façade du catalogue — VERSION NAÏVE, héritée du TP 2.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ TP 3 — c'est ce fichier que vous allez réécrire.                       │
 * │                                                                        │
 * │ Elle FONCTIONNE : lancez l'application et servez-vous-en. C'est même   │
 * │ l'objet de l'étape 1 — constater ce qu'elle fait de mal avant de la    │
 * │ corriger.                                                              │
 * │                                                                        │
 * │ Ses trois défauts, que les tests décrivent :                           │
 * │   1. une requête par frappe, sans exception ;                          │
 * │   2. aucune annulation : une réponse lente écrase une réponse récente ;│
 * │   3. une erreur réseau n'est pas réessayée.                            │
 * │                                                                        │
 * │ Votre travail : remplacer `rafraichir()` et `charger()` par un         │
 * │ pipeline RxJS, SANS toucher à la surface publique — aucun composant    │
 * │ ne doit être modifié.                                                  │
 * └────────────────────────────────────────────────────────────────────────┘
 */
@Injectable({ providedIn: 'root' })
export class CatalogueFacade {
  private readonly api = inject(CatalogueApi);

  private readonly _filtres = signal<Filtres>(FILTRES_VIDES);
  private readonly _page = signal<PageProduits>(PAGE_VIDE);
  private readonly _chargement = signal(false);
  private readonly _erreur = signal<string | null>(null);

  readonly filtres = this._filtres.asReadonly();
  readonly enChargement = this._chargement.asReadonly();
  readonly erreur = this._erreur.asReadonly();

  readonly produits = computed<readonly Produit[]>(() => this._page().items);
  readonly total = computed<number>(() => this._page().total);
  readonly facettes = computed<Facettes>(() => this._page().facettes);

  /**
   * TODO TP 3 — étapes 3 à 6
   *
   * Introduire une source d'événements, et construire le pipeline dessus :
   *
   *   private readonly demandes = new Subject<Filtres>();
   *
   *   filter               une lettre ne part pas au serveur
   *                        (réutiliser `rechercheExploitable`, du domaine)
   *   debounceTime         DELAI_FRAPPE_MS
   *   distinctUntilChanged avec `memesFiltres`, pas JSON.stringify
   *   switchMap            vers this.api.rechercher(filtres), et à l'intérieur :
   *     retry              TENTATIVES fois, avec un délai croissant
   *     map                vers un état chargé
   *     catchError         À L'INTÉRIEUR du switchMap — testez les deux positions
   *     startWith          l'état de chargement, à chaque requête
   *
   * Puis exposer le résultat avec `toSignal(..., { initialValue: … })` : une
   * seule souscription, nettoyée avec l'injecteur. Aucun `subscribe` manuel —
   * un test de structure le vérifie.
   *
   * DELAI_FRAPPE_MS, TENTATIVES et memesFiltres sont fournis en bas de fichier.
   */
  rafraichir(): void {
    void this.charger();
  }

  /** Version naïve : un appel direct, sans debounce ni annulation. */
  private async charger(): Promise<void> {
    this._chargement.set(true);
    this._erreur.set(null);
    try {
      this._page.set(await firstValueFrom(this.api.rechercher(this._filtres())));
    } catch {
      this._page.set(PAGE_VIDE);
      this._erreur.set('catalogue_indisponible');
    } finally {
      this._chargement.set(false);
    }
  }

  // --- commandes : la surface publique ne doit PAS changer ---------------------

  rechercher(recherche: string): void {
    this.modifier({ recherche });
  }

  filtrerParPiece(piece: Filtres['piece']): void {
    this.modifier({ piece });
  }

  filtrerParMatiere(matiere: Filtres['matiere']): void {
    this.modifier({ matiere });
  }

  trier(tri: Filtres['tri']): void {
    this.modifier({ tri });
  }

  allerALaPage(page: number): void {
    this.modifier({ page });
  }

  reinitialiser(): void {
    this._filtres.set(FILTRES_VIDES);
    this.rafraichir();
  }

  private modifier(modification: Partial<Filtres>): void {
    this._filtres.update((filtres) => appliquer(filtres, modification));
    this.rafraichir();
  }
}

/** Délai de silence avant d'envoyer une recherche, en millisecondes. */
export const DELAI_FRAPPE_MS = 300;

/** Nombre de nouvelles tentatives après un échec réseau. */
export const TENTATIVES = 2;

/**
 * Comparateur explicite plutôt que `JSON.stringify` : celui-ci dépend de
 * l'ordre des clés, et casse silencieusement le jour où le type change.
 */
export function memesFiltres(a: Filtres, b: Filtres): boolean {
  return (
    a.recherche.trim() === b.recherche.trim() &&
    a.piece === b.piece &&
    a.matiere === b.matiere &&
    a.prixMax === b.prixMax &&
    a.tri === b.tri &&
    a.page === b.page
  );
}
