import { api } from "./api";
import type { CollectionName, ServerCollections } from "./api";
import type { StudentProfile } from "../types";

/**
 * Suivi des modifications faites **sans serveur**, en attente d'être envoyées.
 *
 * Avant ce module, une modification hors ligne restait dans `localStorage` et
 * était **écrasée au rechargement suivant** par l'état du serveur : le travail
 * était perdu sans le moindre message. C'est le trou que ce registre comble.
 *
 * Il ne décide rien tout seul. Le bureau est partagé (plusieurs comptes staff
 * sur les mêmes données) et les collections sont remplacées **en bloc**, jamais
 * fusionnées ligne à ligne : renvoyer automatiquement le cache local écraserait
 * sans avertissement ce qu'un collègue aurait modifié entre-temps. Le registre
 * se contente donc de retenir *ce qui* a changé, et l'utilisateur tranche à la
 * reconnexion — décision explicite, prise en connaissance de cause.
 *
 * Le registre vit dans `localStorage` pour survivre à une fermeture d'onglet :
 * une modification hors ligne le vendredi doit encore être proposée le lundi.
 */

const PENDING_KEY = "horizon_pending_sync";

/**
 * Libellés lisibles, et **liste blanche** des clés rejouables.
 *
 * Une clé absente d'ici n'est pas rejouée : c'est ce qui empêche une entrée
 * corrompue ou périmée du `localStorage` de déclencher un envoi arbitraire.
 */
const LABELS: Record<string, string> = {
  horizon_student: "Profil",
  horizon_trades: "Journal de trading",
  horizon_accounts: "Portefeuilles",
  horizon_notifications: "Notifications",
  horizon_badges: "Badges",
  // Ajoutée après coup (module Setups) : sans elle, `markPending` ignorait
  // silencieusement toute modification hors ligne (ou après échec réseau)
  // de cette collection, qui repartait donc écrasée par l'état serveur
  // périmé au rechargement suivant, sans jamais passer par
  // `PendingChangesBanner`.
  horizon_setups: "Setups",
};

/** Clé `localStorage` → collection serveur. Absent pour profil. */
const COLLECTION_BY_KEY: Record<string, CollectionName> = {
  horizon_trades: "trades",
  horizon_accounts: "accounts",
  horizon_notifications: "notifications",
  horizon_badges: "badges",
  horizon_setups: "setups",
};

function read(): string[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // On filtre sur la liste blanche : une clé inconnue ne doit rien déclencher.
    return Array.isArray(parsed)
      ? parsed.filter((k): k is string => typeof k === "string" && k in LABELS)
      : [];
  } catch {
    return [];
  }
}

/**
 * Abonnement au registre — seul `PendingChangesBanner`/`useBootstrap` en ont
 * besoin : sans lui, `pending` (`useBootstrap`) n'était calculé QU'AU
 * DÉMARRAGE, et un échec de sauvegarde survenant en cours de session
 * (`markPending`, appelé depuis `useSyncedState` sur un 409/coupure réseau)
 * ne mettait jamais à jour le bandeau persistant — seul le `SyncErrorBanner`
 * ponctuel et refermable le signalait, jusqu'au prochain rechargement complet
 * de la page. Trouvé en audit.
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribePending(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(keys: string[]): void {
  try {
    if (keys.length === 0) localStorage.removeItem(PENDING_KEY);
    else localStorage.setItem(PENDING_KEY, JSON.stringify([...new Set(keys)]));
  } catch {
    // Stockage indisponible : on ne peut rien retenir, mais rien ne casse non
    // plus — on retombe sur le comportement d'avant, « le serveur fait foi ».
  }
  listeners.forEach((listener) => listener());
}

/** Note qu'une collection a été modifiée hors ligne. Idempotent. */
export function markPending(localKey: string): void {
  if (!(localKey in LABELS)) return;
  const current = read();
  if (current.includes(localKey)) return;
  write([...current, localKey]);
}

/** Clés en attente d'envoi, dans l'ordre d'apparition. */
export function listPending(): string[] {
  return read();
}

/** Libellés lisibles correspondants, pour l'affichage. */
export function describePending(keys: string[]): string[] {
  return keys.map((k) => LABELS[k] ?? k);
}

export function clearPending(): void {
  write([]);
}

/**
 * Vide `localStorage` en conservant uniquement les clés portant une
 * modification réellement non envoyée (`listPending()`) et le registre
 * lui-même.
 *
 * Utilisée quand une session STAFF expire ou est révoquée pendant l'usage
 * (`useAuth.onUnauthenticated`) : contrairement à un `localStorage.clear()`
 * total (appliqué côté élève), cette purge CIBLÉE protège le travail non
 * encore synchronisé d'un coach réellement hors ligne, tout en effaçant le
 * reste du cache — notamment `horizon_enrolled_students` (roster complet des
 * élèves), qui sinon restait lisible en clair indéfiniment sur le poste d'un
 * coach dont l'accès vient d'être révoqué. Faille trouvée en audit de
 * sécurité : le cache de LECTURE n'a aucune raison de survivre à une session
 * qui n'est plus valide, seul le travail non-envoyé le justifie.
 */
export function purgeCacheKeepingPending(): void {
  try {
    const keep = new Set(listPending());
    keep.add(PENDING_KEY);
    for (const key of Object.keys(localStorage)) {
      if (!keep.has(key)) localStorage.removeItem(key);
    }
  } catch {
    // Stockage indisponible : rien à purger.
  }
}

/**
 * Envoie au serveur la valeur locale d'une clé en attente.
 *
 * Lit la valeur dans `localStorage` plutôt que de la recevoir en argument :
 * l'état React courant peut avoir été remonté depuis le serveur entre-temps,
 * alors que le cache, lui, porte bien la version hors ligne — c'est
 * précisément celle qu'on veut renvoyer.
 */
async function pushOne(localKey: string): Promise<void> {
  const raw = localStorage.getItem(localKey);
  if (raw === null) return;

  const value: unknown = JSON.parse(raw);

  if (localKey === "horizon_student") {
    await api.saveProfile(value as StudentProfile);
    return;
  }

  const collection = COLLECTION_BY_KEY[localKey];
  if (!collection) return;

  // Une collection doit être un tableau : un cache corrompu ferait échouer la
  // validation serveur avec un message obscur, autant s'arrêter ici.
  if (!Array.isArray(value)) {
    throw new Error(`Cache local illisible pour « ${LABELS[localKey] ?? localKey} ».`);
  }

  await api.saveCollection(
    collection,
    value as ServerCollections[typeof collection]
  );
}

export interface ReplayResult {
  /** Libellés effectivement envoyés. */
  envoyes: string[];
  /** Libellés ayant échoué, avec le motif. */
  echecs: { label: string; motif: string }[];
}

/**
 * Rejoue toutes les modifications en attente.
 *
 * Les clés sont traitées **séquentiellement et non en parallèle** : sur un
 * échec réseau au milieu, on sait exactement ce qui est passé et ce qui ne
 * l'est pas. Une clé qui échoue **reste en attente**, pour pouvoir être
 * reproposée au prochain démarrage plutôt que d'être perdue silencieusement.
 */
export async function replayPending(): Promise<ReplayResult> {
  const keys = listPending();
  const envoyes: string[] = [];
  const echecs: { label: string; motif: string }[] = [];
  const restants: string[] = [];

  for (const key of keys) {
    const label = LABELS[key] ?? key;
    try {
      await pushOne(key);
      envoyes.push(label);
    } catch (err) {
      echecs.push({ label, motif: (err as Error).message || "Envoi refusé." });
      restants.push(key);
    }
  }

  write(restants);
  return { envoyes, echecs };
}
