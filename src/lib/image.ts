/**
 * Préparation des images téléversées avant stockage.
 *
 * Les avatars vivent dans le profil (`StudentProfile.avatar`), qui est
 * sérialisé en JSON : dans la base, dans chaque réponse de `/api/state`, et
 * dans le cache localStorage. Une image brute encodée en base64 y pèse donc son
 * poids réel majoré d'un tiers, et à trois endroits à la fois.
 *
 * On réduit l'image ici, côté navigateur, avant qu'elle n'entre dans l'état
 * applicatif. Rien en aval n'a alors à s'en préoccuper.
 */

/**
 * Côté de l'avatar stocké, en pixels.
 *
 * L'affichage le plus grand fait 80 px (l'aperçu de la modale de profil) ; les
 * autres font 32, 36 et 44 px. 256 px couvre donc le double de la plus grande
 * taille, ce qui reste net sur un écran à forte densité.
 */
export const AVATAR_SIZE = 256;

/** Qualité d'encodage. 0.85 : pas de dégradation visible à cette taille. */
const AVATAR_QUALITY = 0.85;

/**
 * Couleur de repli pour les zones transparentes quand le navigateur ne sait
 * pas produire de WebP. C'est la surface sur laquelle l'avatar est posé.
 */
const SURFACE_COLOR = "#111615";

/** Le format le plus compact que sait produire ce navigateur. */
function pickFormat(): "image/webp" | "image/jpeg" {
  const probe = document.createElement("canvas");
  probe.width = 1;
  probe.height = 1;
  return probe.toDataURL("image/webp").startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";
}

/**
 * Décode le fichier en une source dessinable.
 *
 * `createImageBitmap` est préféré quand il existe : il redresse l'image selon
 * son orientation EXIF, ce que les photos prises au téléphone exigent, et
 * décode hors du fil principal.
 */
async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Réduit une image téléversée en un carré de `size` pixels, encodé en data URI.
 *
 * Le recadrage est centré et conserve les proportions : c'est exactement ce que
 * fait l'affichage (`object-cover` dans un cercle), donc recadrer ici ne retire
 * rien qui aurait été visible.
 *
 * @throws si le fichier n'est pas une image décodable.
 */
export async function resizeAvatar(file: File, size = AVATAR_SIZE): Promise<string> {
  const source = await decode(file);

  try {
    const side = Math.min(source.width, source.height);
    const sx = (source.width - side) / 2;
    const sy = (source.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Contexte de rendu indisponible.");

    ctx.imageSmoothingQuality = "high";

    const format = pickFormat();
    // Le JPEG n'a pas de canal alpha : sans ce fond, les zones transparentes
    // deviendraient noires au lieu de se fondre dans l'interface.
    if (format === "image/jpeg") {
      ctx.fillStyle = SURFACE_COLOR;
      ctx.fillRect(0, 0, size, size);
    }

    ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size);

    return canvas.toDataURL(format, AVATAR_QUALITY);
  } finally {
    // Un ImageBitmap retient sa mémoire décodée tant qu'on ne le ferme pas.
    if ("close" in source && typeof source.close === "function") source.close();
  }
}

/**
 * Plus grande dimension (largeur ou hauteur) conservée pour une capture
 * d'écran de trade.
 *
 * Contrairement à l'avatar, on ne recadre pas en carré : un graphique de
 * bougies perdrait toute sa lisibilité recadré. On réduit seulement l'image
 * si elle dépasse cette taille, en conservant ses proportions — 1600 px
 * suffit à relire un niveau de prix ou une mèche à l'écran, largement au-delà
 * de la largeur d'affichage réelle dans le journal.
 */
export const CHART_SCREENSHOT_MAX_DIMENSION = 1600;

/** Qualité d'encodage. Un peu inférieure à l'avatar : ces images sont bien
 *  plus grandes, le gain de poids l'emporte sur la perte, à peine visible sur
 *  un graphique. */
const CHART_SCREENSHOT_QUALITY = 0.82;

/**
 * Réduit une capture d'écran de trade avant stockage, sans la recadrer.
 *
 * Mêmes contraintes que l'avatar (§ plus haut) : l'image finit en JSON, donc
 * en base, dans chaque réponse de `/api/state` et dans le cache
 * `localStorage`. Une capture d'écran brute (souvent plusieurs Mo) y pèserait
 * son poids trois fois.
 *
 * @throws si le fichier n'est pas une image décodable.
 */
export async function resizeChartScreenshot(
  file: File,
  maxDimension = CHART_SCREENSHOT_MAX_DIMENSION
): Promise<string> {
  const source = await decode(file);

  try {
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Contexte de rendu indisponible.");

    ctx.imageSmoothingQuality = "high";

    const format = pickFormat();
    if (format === "image/jpeg") {
      ctx.fillStyle = SURFACE_COLOR;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(source, 0, 0, width, height);

    return canvas.toDataURL(format, CHART_SCREENSHOT_QUALITY);
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
  }
}
