import { schema } from '@angular/forms/signals';
import { Commande } from '@maison/commande/domaine';

/**
 * Règles de validation du tunnel de commande.
 *
 * Extrait du composant à dessein : un schéma se teste sans monter d'interface,
 * sans DOM et sans clic. C'est l'apport principal des Signal Forms par rapport
 * aux Reactive Forms, où la validation finit mêlée à la construction du
 * FormGroup.
 *
 * `base` est passée en paramètre plutôt qu'injectée : le schéma reste une
 * fonction pure de configuration.
 *
 * Le schéma est vide : le formulaire s'affiche, et accepte n'importe quoi.
 * Les tests de commande.schema.spec.ts décrivent chaque règle, et les messages
 * exacts.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function schemaCommande(base: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return schema<Commande>((c) => {
    // TODO TP 6 — étape 1 : les règles synchrones
    //   required, email, pattern (FORMAT_CODE_POSTAL, dans le domaine), validate pour les CGV.
    // TODO TP 6 — étape 2 : la zone de livraison, vérifiée par l'API
    //   validateHttp sur c.codePostal, vers `${base}/validation/code-postal/<code>`.
  });
}
