import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_URL } from '@maison/partage/util';
import { firstValueFrom } from 'rxjs';

export interface EtatStock {
  readonly id: string;
  readonly disponible: boolean;
  readonly quantite: number;
}

/** Intervalle de rafraîchissement du stock, en millisecondes. */
export const PERIODE_STOCK_MS = 15_000;

/**
 * Stock temps réel.
 *
 * Ce service se met à jour depuis un `setInterval`, donc en dehors de tout
 * événement Angular. Sous Zone.js, le rafraîchissement de l'affichage était
 * accidentel : Zone.js interceptait le timer et déclenchait un cycle global.
 * Ici, rien ne l'intercepte — c'est au signal de notifier, et à rien d'autre.
 *
 * FOURNI : la surveillance (`surveiller`, `rafraichir`, `interroger`). Elle
 * fonctionne, mais sa minuterie fuit : c'est l'étape 3.
 *
 * Pas de `subscribe` : le test de structure du TP 3 l'interdit, et
 * `firstValueFrom` suffit pour une requête qui n'émet qu'une fois.
 */
@Injectable({ providedIn: 'root' })
export class StockStore {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);

  /**
   * Une Map immuable : chaque mise à jour doit produire une NOUVELLE référence.
   * Muter la Map en place ne notifierait personne — c'est le piège n° 1 du
   * passage en zoneless, et il est silencieux.
   */
  private readonly _stocks = signal<ReadonlyMap<string, EtatStock>>(new Map());
  private readonly _surveilles = signal<readonly string[]>([]);

  readonly stocks = this._stocks.asReadonly();
  readonly surveilles = this._surveilles.asReadonly();
  readonly nbSurveilles = computed(() => this._surveilles().length);

  private minuterie: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // TODO TP 4 — étape 3 : déclarer le nettoyage ici, au même endroit que la
    // ressource qu'il libère (indice : DestroyRef).
  }

  /**
   * TODO TP 4 — étape 1
   * Lecture réactive : appelée dans un template, elle doit créer la dépendance.
   * `null` si le produit n'a pas encore été interrogé — un état distinct de la
   * rupture.
   */
  quantite(id: string): number | null {
    throw new Error('TP 4 — StockStore.quantite reste à écrire');
  }

  /** TODO TP 4 — étape 1 */
  estDisponible(id: string): boolean | null {
    throw new Error('TP 4 — StockStore.estDisponible reste à écrire');
  }

  /** Surveiller une nouvelle liste : interroger tout de suite, puis à chaque période. */
  surveiller(ids: readonly string[]): void {
    // TODO TP 4 — étape 3 : la minuterie précédente n'est jamais arrêtée.
    this._surveilles.set([...ids]);
    this.rafraichir();
    this.minuterie = setInterval(() => this.rafraichir(), PERIODE_STOCK_MS);
  }

  rafraichir(): void {
    for (const id of this._surveilles()) {
      void this.interroger(id);
    }
  }

  /** TODO TP 4 — étape 3 : ne fait encore rien. */
  arreter(): void {
    return;
  }

  /** Une panne de stock ne doit pas casser l'affichage du catalogue. */
  private async interroger(id: string): Promise<void> {
    try {
      this.enregistrer(await firstValueFrom(this.http.get<EtatStock>(`${this.base}/stocks/${id}`)));
    } catch {
      // volontairement ignoré : le badge restera sur sa dernière valeur connue
    }
  }

  /**
   * TODO TP 4 — étape 1
   * Attention : `this._stocks().set(...)` muterait la Map EN PLACE, et ne
   * notifierait personne. C'est le piège central de ce TP.
   */
  private enregistrer(etat: EtatStock): void {
    throw new Error('TP 4 — StockStore.enregistrer reste à écrire');
  }
}
