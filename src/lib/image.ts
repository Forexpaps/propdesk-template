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
