import { useEffect, useState } from "react";

/**
 * useState dont la valeur survit au rechargement de la page.
 *
 * Remplace le motif useState(() => JSON.parse(localStorage...)) + useEffect
 * d'écriture qui était répété pour chaque collection de l'application.
 *
 * Contrairement à ce motif, la lecture est tolérante aux pannes : une clé
 * corrompue (écriture interrompue, édition manuelle, quota dépassé) retombe
 * sur la valeur initiale au lieu de faire échouer le rendu de toute l'app.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
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
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Quota dépassé ou stockage indisponible (navigation privée) : on garde
      // l'état en mémoire plutôt que de casser l'interaction en cours.
      console.warn(`[horizon] Sauvegarde locale impossible pour "${key}".`, err);
    }
  }, [key, value]);

  return [value, setValue];
}
