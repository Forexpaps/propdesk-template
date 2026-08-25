import { useEffect, useRef } from "react";
import { AppNotification } from "../types";

/** Même clé que le bouton son du Centre d'alerte — `NotificationModal.tsx`. */
const SOUND_PREF_KEY = "horizon_sound_alerts";

function isSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(SOUND_PREF_KEY);
    // Absent = jamais réglé = activé par défaut, même valeur initiale que
    // `usePersistentState("horizon_sound_alerts", true)` dans NotificationModal.
    return raw === null ? true : JSON.parse(raw) === true;
  } catch {
    return true;
  }
}

/**
 * Bip court généré via Web Audio — pas de fichier son à charger/héberger.
 * `AudioContext` échoue silencieusement tant qu'aucune interaction n'a eu
 * lieu sur la page (politique autoplay des navigateurs) : après la première
 * interaction (connexion, clic...), il fonctionne normalement.
 */
function playAlertBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
    oscillator.onended = () => ctx.close();
  } catch {
    // Contexte audio indisponible : silencieux, jamais bloquant pour le reste de l'app.
  }
}

/**
 * Joue un bip à chaque NOUVELLE notification (id jamais vu depuis que
 * `ready` est passé à `true`) — jamais au chargement initial pour les
 * notifications déjà existantes, jamais pour une notification qui change
 * juste de statut lu/non lu (même id, toujours dans `knownIds`).
 *
 * `ready` doit rester `false` tant que la valeur de `notifications` n'est
 * pas définitive (ex: encore en train de charger depuis le serveur) — sinon
 * le remplacement de la valeur initiale par les vraies données serveur se
 * lirait comme un déluge de "nouvelles" notifications à l'ouverture.
 */
export function useNotificationSound(notifications: AppNotification[], ready: boolean): void {
  const knownIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready) return;

    const currentIds = new Set(notifications.map((n) => n.id));

    if (knownIds.current === null) {
      // Première fois que `ready` vaut `true` : mémorise l'existant sans
      // jouer de son, ce sont des notifications déjà là, pas de nouvelles.
      knownIds.current = currentIds;
      return;
    }

    const hasNew = notifications.some((n) => !knownIds.current!.has(n.id));
    knownIds.current = currentIds;

    if (hasNew && isSoundEnabled()) {
      playAlertBeep();
    }
  }, [notifications, ready]);
}
