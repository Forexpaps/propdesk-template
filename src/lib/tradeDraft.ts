import { TradeDraft } from "../types";

/**
 * Applique une ébauche (calculateur de position) sur un formulaire vierge.
 *
 * Existe comme fonction pure, et pas en ligne dans `TradingJournal.tsx`, à
 * cause du bug qu'elle corrige : `TradeDraft` porte des NOMBRES
 * (`entryPrice`, `stopLoss`, `takeProfit`, `lotSize`, `riskPercent`) tandis
 * que l'état du formulaire ne manipule que des CHAÎNES — ses champs sont des
 * `<input type="text">` relus par `parsePriceInput`, qui commence par
 * `raw.trim()`.
 *
 * Recopier l'ébauche telle quelle déposait donc des nombres dans l'état, et
 * l'enregistrement levait `raw.trim is not a function` : le trade n'était
 * JAMAIS enregistré, le formulaire restait ouvert, et rien n'expliquait
 * pourquoi. Tout le chemin « Appliquer au Journal » était inutilisable, et
 * c'est la raison pour laquelle aucun trade du journal ne porte de risque
 * saisi — donc pour laquelle les badges de gestion du risque restaient à zéro.
 *
 * La conversion suit le TYPE DU CHAMP VIERGE, jamais une liste de noms à tenir
 * à jour : un futur champ numérique ajouté à `TradeDraft` sera converti sans
 * qu'on y pense.
 */
export function appliquerDraft<T extends Record<string, unknown>>(vierge: T, draft: TradeDraft): T {
  const resultat = { ...vierge };
  for (const cle of Object.keys(draft) as (keyof TradeDraft)[]) {
    const valeur = draft[cle];
    if (valeur === undefined) continue;
    // Une clé absente du formulaire vierge est ignorée plutôt qu'ajoutée :
    // l'ébauche ne doit pas pouvoir inventer un champ que le formulaire ne
    // sait ni afficher ni enregistrer.
    if (!(cle in resultat)) continue;
    const attendu = (resultat as Record<string, unknown>)[cle];
    (resultat as Record<string, unknown>)[cle] =
      typeof attendu === "string" && typeof valeur === "number" ? String(valeur) : valeur;
  }
  return resultat;
}
