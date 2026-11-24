import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Commande } from '@maison/commande/domaine';
import { Panier } from '@maison/panier/domaine';
import { PanierStore } from '@maison/panier/data-access';
import { API_URL } from '@maison/partage/util';
import { firstValueFrom } from 'rxjs';

/**
 * Résultat d'un envoi de commande.
 *
 * Une union discriminée plutôt qu'un booléen : chaque issue porte ce dont
 * l'interface a besoin pour réagir. Avec `{ succes: false }`, il faudrait un
 * second champ pour savoir quoi afficher — et rien n'obligerait à le remplir.
 */
export type ResultatCommande =
  | { readonly statut: 'enregistree'; readonly reference: string }
  | { readonly statut: 'panier-vide' }
  | { readonly statut: 'stock-insuffisant'; readonly produitId: string }
  | { readonly statut: 'non-authentifie' }
  | { readonly statut: 'indisponible' };

interface ReponseCommande {
  id: string;
}

@Injectable({ providedIn: 'root' })
export class CommandeStore {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_URL);
  private readonly panier = inject(PanierStore);

  private readonly _envoi = signal(false);
  private readonly _dernier = signal<ResultatCommande | null>(null);

  readonly envoiEnCours = this._envoi.asReadonly();
  readonly dernierResultat = this._dernier.asReadonly();
  readonly reference = computed(() => {
    const resultat = this._dernier();
    return resultat?.statut === 'enregistree' ? resultat.reference : null;
  });

  /**
   * Envoie la commande. Fourni : le chemin du succès, corps compris.
   *
   * TODO TP 9 — étape 2
   * Ne rejette JAMAIS : chaque issue est un statut. Les tests attendent encore :
   *   - un panier vide ne déclenche aucune requête ;
   *   - le panier est vidé, et SEULEMENT en cas de succès ;
   *   - une erreur HTTP devient un statut (voir `interpreter`) ;
   *   - l'état d'envoi se termine, y compris après une erreur.
   */
  async envoyer(commande: Commande, lignes: Panier): Promise<ResultatCommande> {
    // Le corps n'envoie que produitId et quantite : le serveur refait le calcul
    // des prix. Un client qui envoie ses propres montants invite à la fraude.
    const reponse = await firstValueFrom(
      this.http.post<ReponseCommande>(`${this.base}/commandes`, {
        ...commande,
        lignes: lignes.map((ligne) => ({
          produitId: ligne.produitId,
          quantite: ligne.quantite,
        })),
      }),
    );
    return this.conclure({ statut: 'enregistree', reference: reponse.id });
  }

  /**
   * Traduit une erreur HTTP en statut métier.
   *
   * C'est la même discipline que le mapping DTO du TP 2 : aucun composant n'a
   * à connaître `HttpErrorResponse` ni la valeur 409.
   *
   * TODO TP 9 — étape 2 : 401, 409 (avec produitId), et le reste.
   */
  private interpreter(erreur: unknown): ResultatCommande {
    throw new Error('TP 9 — interpreter reste à écrire');
  }

  private conclure(resultat: ResultatCommande): ResultatCommande {
    this._dernier.set(resultat);
    return resultat;
  }
}
