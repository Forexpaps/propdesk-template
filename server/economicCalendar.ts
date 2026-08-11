/**
 * Calendrier économique en direct — proxy et cache autour du flux public
 * ForexFactory (`nfs.faireconomy.media`), utilisé par leur propre widget
 * embarquable : aucune clé API, aucune authentification.
 *
 * ForexFactory limite ce flux à 2 requêtes / 5 min par IP. Comme ce serveur
 * est partagé par tous les visiteurs de l'app, l'appeler directement depuis
 * chaque navigateur exploserait cette limite en quelques secondes. Un cache
 * mémoire ici, interrogé une seule fois par fenêtre de `CACHE_TTL_MS`,
 * garde l'app entière sous la limite quel que soit le nombre d'utilisateurs.
 */

const FEED_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;

export interface EconomicCalendarEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
}

interface RawFeedItem {
  title?: unknown;
  country?: unknown;
  date?: unknown;
  impact?: unknown;
  forecast?: unknown;
  previous?: unknown;
}

let cache: { data: EconomicCalendarEvent[]; fetchedAt: number } | null = null;
/** Une seule requête en vol même si plusieurs clients arrivent pendant un cache expiré. */
let inflight: Promise<EconomicCalendarEvent[]> | null = null;

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Normalisation volontairement minimale : le serveur reste un simple relais
 * de données, comme le reste de l'app (voir `repositories.ts`). Le mapping
 * devise → drapeau et impact → couleur est une question de présentation,
 * laissée au client (`EconomicCalendarModal.tsx`).
 */
function normalize(raw: unknown): EconomicCalendarEvent[] {
  if (!Array.isArray(raw)) {
    throw new Error("Réponse du flux ForexFactory inattendue (pas un tableau).");
  }

  return raw.map((item, index) => {
    const r = item as RawFeedItem;
    const title = coerceString(r.title);
    const country = coerceString(r.country).toUpperCase();
    const date = coerceString(r.date);
    return {
      // Identifiant stable tant que le flux ne change pas d'ordre — suffisant
      // pour une clé React, cet id n'est jamais persisté.
      id: `${date}-${country}-${index}`,
      title,
      country,
      date,
      impact: coerceString(r.impact),
      forecast: coerceString(r.forecast),
      previous: coerceString(r.previous),
    };
  });
}

async function fetchFromForexFactory(): Promise<EconomicCalendarEvent[]> {
  const response = await fetch(FEED_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Flux ForexFactory : réponse ${response.status}.`);
  }

  const body = await response.json();
  return normalize(body);
}

/**
 * Retourne le calendrier économique de la semaine, depuis le cache si frais.
 *
 * En cas d'échec réseau, retourne le dernier cache connu — même expiré —
 * plutôt que de faire planter l'UI pour un hoquet passager du flux. Ne lève
 * que si aucun cache n'a jamais été constitué (typiquement juste après un
 * démarrage serveur, avant la toute première requête réussie).
 */
export async function getEconomicCalendar(): Promise<EconomicCalendarEvent[]> {
  const isFresh = cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (isFresh) return cache!.data;

  if (inflight) return inflight;

  inflight = fetchFromForexFactory()
    .then((data) => {
      cache = { data, fetchedAt: Date.now() };
      return data;
    })
    .catch((err) => {
      console.warn("[economic-calendar] Échec du rafraîchissement du flux ForexFactory.", err);
      if (cache) return cache.data;
      throw err;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
