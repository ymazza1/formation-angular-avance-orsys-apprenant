import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { appliquer, Filtres, FILTRES_VIDES, Produit } from '@maison/catalogue/domaine';
import { catchError, map, mergeMap, of, startWith, Subject } from 'rxjs';
import { CatalogueApi, Facettes, PAGE_VIDE, PageProduits } from './catalogue.api';

/** Ce que la page affiche, en une seule valeur : jamais deux signaux à synchroniser. */
interface EtatCatalogue {
  readonly page: PageProduits;
  readonly erreur: string | null;
  readonly chargement: boolean;
}

const ETAT_INITIAL: EtatCatalogue = { page: PAGE_VIDE, erreur: null, chargement: false };

/**
 * Façade du catalogue — VERSION NAÏVE.
 *
 * Elle FONCTIONNE : lancez l'application et servez-vous-en, c'est l'objet de
 * l'étape 1. Mais elle a trois défauts, un par étape :
 *   1. une requête par frappe, sans exception ;
 *   2. aucune annulation : une réponse lente écrase une réponse récente ;
 *   3. la première erreur réseau tue le flux : plus rien ne se charge ensuite.
 *
 * La surface publique (signaux et commandes) ne doit PAS changer : aucun
 * composant n'est touché par ce TP.
 */
@Injectable({ providedIn: 'root' })
export class CatalogueFacade {
  private readonly api = inject(CatalogueApi);

  private readonly _filtres = signal<Filtres>(FILTRES_VIDES);
  readonly filtres = this._filtres.asReadonly();

  /**
   * Source d'événements. Un Subject plutôt que `toObservable(this._filtres)` :
   * on modélise une SUITE DE DEMANDES dans le temps, pas la valeur courante des
   * filtres — celle-ci est déjà un signal.
   */
  private readonly demandes = new Subject<Filtres>();

  /**
   * `toSignal` souscrit une seule fois et se désabonne avec l'injecteur : aucun
   * `subscribe` manuel (un test de structure le vérifie).
   */
  private readonly etat = toSignal(
    this.demandes.pipe(
      // TODO TP 3 — étape 1 : filter, debounceTime, distinctUntilChanged

      // TODO TP 3 — étape 2 : mergeMap laisse vivre toutes les requêtes
      mergeMap((filtres) =>
        this.api.rechercher(filtres).pipe(
          map((page): EtatCatalogue => ({ page, erreur: null, chargement: false })),
          // TODO TP 3 — étape 3 : retry et catchError
          startWith<EtatCatalogue>({ page: PAGE_VIDE, erreur: null, chargement: true }),
        ),
      ),
      // TODO TP 3 — étape 3 : ce catchError est au mauvais niveau
      catchError(() =>
        of<EtatCatalogue>({ page: PAGE_VIDE, erreur: 'catalogue_indisponible', chargement: false }),
      ),
    ),
    { initialValue: ETAT_INITIAL },
  );

  readonly produits = computed<readonly Produit[]>(() => this.etat().page.items);
  readonly total = computed<number>(() => this.etat().page.total);
  readonly facettes = computed<Facettes>(() => this.etat().page.facettes);
  readonly enChargement = computed<boolean>(() => this.etat().chargement);
  readonly erreur = computed<string | null>(() => this.etat().erreur);

  // --- commandes : la surface publique ne doit PAS changer ---------------------

  /** Premier chargement, et bouton « réessayer ». */
  rafraichir(): void {
    this.demandes.next(this._filtres());
  }

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
