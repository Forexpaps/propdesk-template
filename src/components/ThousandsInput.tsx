import React, { useRef } from "react";

/**
 * Formatage français : point tous les 3 chiffres de la partie entière,
 * virgule comme séparateur décimal affiché (ex: `20637.5` → `20.637,5`).
 * `raw` reste toujours en interne `-?\d*\.?\d*` (point décimal, jamais de
 * séparateur de milliers) — c'est ce qui part en soumission et alimente les
 * calculs (RR, PnL...). Le point de `raw` n'est JAMAIS le même caractère
 * que le point de milliers affiché : la conversion se fait uniquement ici,
 * à l'affichage.
 */
function formatGrouped(raw: string): string {
  if (!raw) return raw;
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const dotIndex = body.indexOf(".");
  const intPart = dotIndex === -1 ? body : body.slice(0, dotIndex);
  const decimalDigits = dotIndex === -1 ? "" : body.slice(dotIndex + 1);
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimalPart = dotIndex === -1 ? "" : `,${decimalDigits}`;
  return `${negative ? "-" : ""}${groupedInt}${decimalPart}`;
}

/**
 * Compte les caractères "significatifs" — tout sauf le point de milliers
 * affiché. Compter seulement les chiffres plaçait le curseur juste avant
 * une virgule tout juste tapée en fin de valeur : la virgule n'étant
 * rattachée à aucun chiffre, elle ne comptait pour rien dans le
 * repositionnement.
 */
function countSignificant(s: string): number {
  let n = 0;
  for (const ch of s) if (ch !== ".") n++;
  return n;
}

/** Position, dans `formatted`, juste après le N-ième caractère significatif. */
function cursorForSignificantCount(formatted: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ".") {
      seen += 1;
      if (seen === count) return i + 1;
    }
  }
  return formatted.length;
}

interface ThousandsInputProps {
  /** Valeur brute, séparateur décimal = point, jamais de point de milliers. */
  value: string;
  onChange: (raw: string) => void;
  allowNegative?: boolean;
  className?: string;
  required?: boolean;
  placeholder?: string;
}

/**
 * Champ prix/montant en texte libre avec regroupement par milliers affiché
 * en direct à la française (`20.637,50`), curseur repositionné après chaque
 * frappe pour rester au même endroit "logique" dans le nombre.
 *
 * La touche décimale (virgule sur clavier français, point sur QWERTY) est
 * interceptée au clavier plutôt que laissée à `onChange` : le caractère
 * affiché à cette position dans le champ (le point de milliers) n'est pas
 * un caractère qu'on peut juste "laisser passer", il faut explicitement
 * insérer le point décimal interne au bon endroit dans `value`.
 */
export const ThousandsInput: React.FC<ThousandsInputProps> = ({
  value,
  onChange,
  allowNegative = false,
  className,
  required,
  placeholder,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const insertDecimalPoint = (el: HTMLInputElement) => {
    const formatted = formatGrouped(value);
    const selStart = el.selectionStart ?? formatted.length;
    const selEnd = el.selectionEnd ?? selStart;
    const rawStart = countSignificant(formatted.slice(0, selStart));
    const rawEnd = countSignificant(formatted.slice(0, selEnd));

    const newRaw = `${value.slice(0, rawStart)}.${value.slice(rawEnd)}`;
    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    // Rejette un second point décimal (ex: virgule tapée alors qu'il y en a
    // déjà un ailleurs que dans la sélection remplacée) — un seul autorisé.
    if (!pattern.test(newRaw)) return;

    onChange(newRaw);

    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const newFormatted = formatGrouped(newRaw);
      const pos = cursorForSignificantCount(newFormatted, rawStart + 1);
      node.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // "," (clavier français) et "." (QWERTY, pavé numérique) valent tous
    // deux "point décimal" — quel que soit le clavier de qui saisit.
    if (e.key !== "," && e.key !== ".") return;
    e.preventDefault();
    insertDecimalPoint(e.currentTarget);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const cursorPos = el.selectionStart ?? el.value.length;
    const significantBeforeCursor = countSignificant(el.value.slice(0, cursorPos));

    // Ce chemin gère le collage (ex: "20.637,50") et tout ce qui échappe à
    // `handleKeyDown` : les points sont retirés (décoration de milliers) et
    // une virgule éventuellement collée devient LE point décimal interne.
    const stripped = el.value.replace(/\./g, "").replace(",", ".");
    const pattern = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;
    if (!pattern.test(stripped)) return;

    onChange(stripped);

    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      const formatted = formatGrouped(stripped);
      const pos = cursorForSignificantCount(formatted, significantBeforeCursor);
      node.setSelectionRange(pos, pos);
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={formatGrouped(value)}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={className}
      required={required}
      placeholder={placeholder}
    />
  );
};
