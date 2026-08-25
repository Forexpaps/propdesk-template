import { useEffect, useRef, useState } from "react";

function readFromStorage<T>(key: string, initialValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? (JSON.parse(saved) as T) : initialValue;
  } catch (err) {
    console.warn(
      `[horizon] Donnée locale illisible pour "${key}", retour aux valeurs par défaut.`,
      err
    );
    return initialValue;
  }
}

/**
 * useState dont la valeur survit au rechargement de la page.
 *
 * Remplace le motif useState(() => JSON.parse(localStorage...)) + useEffect
 * d'écriture qui était répété pour chaque collection de l'application.
 *
 * Contrairement à ce motif, la lecture est tolérante aux pannes : une clé
 * corrompue (écriture interrompue, édition manuelle, quota dépassé) retombe
 * sur la valeur initiale au lieu de faire échouer le rendu de toute l'app.
 *
 * `key` peut changer en cours de vie (ex. clé namespacée par email élève,
 * connue seulement après le chargement asynchrone du profil — voir
 * `readBadgeNotificationIds` dans `src/App.tsx`). Un simple
 * `useState(() => lecture initiale)` ne relit la valeur qu'au tout premier
 * montage : un changement de clé plus tard réutilisait la valeur en mémoire
 * sous l'ANCIENNE clé et l'écrivait telle quelle sous la NOUVELLE — sur un
 * poste déjà utilisé par cet élève, ça écrasait silencieusement ses vraies
 * données déjà namespacées par une valeur périmée (souvent vide). `keyRef`
 * détecte ce changement et relit explicitement sous la nouvelle clé avant
 * toute écriture.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readFromStorage(key, initialValue));
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(readFromStorage(key, initialValue));
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Quota dépassé ou stockage indisponible (navigation privée) : on garde
      // l'état en mémoire plutôt que de casser l'interaction en cours.
      console.warn(`[horizon] Sauvegarde locale impossible pour "${key}".`, err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
}
