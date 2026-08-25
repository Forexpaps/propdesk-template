import React, { useState } from "react";
import { Megaphone, Plus, Pin, PinOff, Trash2, Pencil, ImagePlus, Loader2, X } from "lucide-react";
import { Announcement, AnnouncementCategory } from "../types";
import { resizeChartScreenshot } from "../lib/image";
import { confirmDialog } from "../lib/confirmDialog";

interface AnnouncementsProps {
  announcements: Announcement[];
  /** Publication/édition/suppression réservées au fondateur — lecture seule sinon. */
  isOwner: boolean;
  /** Absent en lecture seule : un élève ou un coach invité ne peut jamais écrire. */
  onSave?: (next: Announcement[]) => void;
}

const CATEGORIES: AnnouncementCategory[] = ["Général", "Alerte marché", "Pédagogie", "Événement"];

/** Même motif que `getEmotionBadge` (TradingJournal.tsx) : une couleur fixe par valeur d'enum. */
const CATEGORY_STYLE: Record<AnnouncementCategory, string> = {
  Général: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  "Alerte marché": "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Pédagogie: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Événement: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

const CATEGORY_EMOJI: Record<AnnouncementCategory, string> = {
  Général: "📌",
  "Alerte marché": "⚠️",
  Pédagogie: "🎓",
  Événement: "📅",
};

const CategoryBadge: React.FC<{ category: AnnouncementCategory }> = ({ category }) => (
  <span
    className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${CATEGORY_STYLE[category]}`}
  >
    {CATEGORY_EMOJI[category]} {category}
  </span>
);

const inputClass =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-[#00E676]/50 placeholder-slate-600";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const EMPTY_FORM = {
  title: "",
  body: "",
  category: "Général" as AnnouncementCategory,
  pinned: false,
  imageUrl: "",
};

export const Announcements: React.FC<AnnouncementsProps> = ({ announcements, isOwner, onSave }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isResizingImage, setIsResizingImage] = useState(false);

  // Épinglées en premier, puis les plus récentes.
  const sorted = [...announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setFormData({ title: a.title, body: a.body, category: a.category, pinned: a.pinned, imageUrl: a.imageUrl ?? "" });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData(EMPTY_FORM);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Sans réinitialiser la valeur, re-choisir le même fichier après une
    // erreur n'émettrait aucun évènement — même motif que TradingJournal.tsx.
    e.target.value = "";
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert("L'image choisie est trop volumineuse (max 20 Mo). Choisis-en une autre.");
      return;
    }

    setIsResizingImage(true);
    try {
      const imageUrl = await resizeChartScreenshot(file);
      setFormData((prev) => ({ ...prev, imageUrl }));
    } catch (err) {
      console.error("[propdesk] Redimensionnement de l'image échoué.", err);
      alert("Cette image n'a pas pu être lue. Essaie un autre fichier (JPEG, PNG ou WebP).");
    } finally {
      setIsResizingImage(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Défense en profondeur : le serveur (`requireOwner`) refuse déjà toute
    // écriture d'un non-fondateur, ce garde n'est qu'une seconde ligne pour
    // qu'un futur bug d'affichage (formulaire monté sans le contrôle
    // `{isOwner && (...)}` autour) ne déclenche même pas l'appel réseau.
    if (!isOwner) return;
    if (!formData.title.trim() || !formData.body.trim()) return;

    const previous = editingId ? announcements.find((a) => a.id === editingId) : undefined;
    const entry: Announcement = {
      // Un id STABLE en édition : c'est ce qui distingue une simple mise à
      // jour d'une vraie nouvelle annonce côté serveur (voir le commentaire
      // de la route PUT /auth/announcements, server/auth/routes.ts) — un id
      // qui changerait à chaque édition renotifierait tous les élèves à
      // chaque fois.
      id: editingId ?? `announce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: formData.title.trim(),
      body: formData.body.trim(),
      category: formData.category,
      pinned: formData.pinned,
      imageUrl: formData.imageUrl || undefined,
      createdAt: previous?.createdAt ?? new Date().toISOString(),
    };

    const next = editingId ? announcements.map((a) => (a.id === editingId ? entry : a)) : [entry, ...announcements];
    onSave?.(next);
    closeForm();
  };

  const handleDelete = async (a: Announcement) => {
    if (!isOwner) return;
    const ok = await confirmDialog(`Supprimer l'annonce « ${a.title} » ? Cette action est irréversible.`, {
      title: "Supprimer cette annonce",
      confirmLabel: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    onSave?.(announcements.filter((x) => x.id !== a.id));
  };

  const togglePin = (a: Announcement) => {
    if (!isOwner) return;
    onSave?.(announcements.map((x) => (x.id === a.id ? { ...x, pinned: !x.pinned } : x)));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#111615] p-6 rounded-xl border border-[#1B2320]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold border border-[#00E676]/20">
            <Megaphone className="w-3.5 h-3.5" />
            Annonces de l'Académie
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {isOwner ? "Publie tes annonces" : "Annonces"}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm">
            {isOwner
              ? "Marché fermé, nouveau setup, événement — visible par tous les élèves."
              : "Les dernières annonces de l'équipe pédagogique."}
          </p>
        </div>

        {isOwner && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#00E676] hover:bg-[#00c865] text-slate-950 font-extrabold text-sm shadow-md transition-all shrink-0 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle annonce</span>
          </button>
        )}
      </div>

      {/* Liste */}
      {sorted.length === 0 ? (
        <div className="bg-[#111615] border border-dashed border-[#1B2320] rounded-xl p-10 text-center">
          <Megaphone className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {isOwner ? "Aucune annonce publiée pour l'instant." : "Aucune annonce pour l'instant."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <div
              key={a.id}
              className={`bg-[#111615] border rounded-xl p-5 space-y-3 ${
                a.pinned ? "border-[#00E676]/40" : "border-[#1B2320]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30">
                        <Pin className="w-3 h-3" /> Épinglée
                      </span>
                    )}
                    <CategoryBadge category={a.category} />
                  </div>
                  <h3 className="text-base font-bold text-white">{a.title}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{formatDate(a.createdAt)}</p>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => togglePin(a)}
                      className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-[#00E676] hover:bg-[#232D29]"
                      title={a.pinned ? "Désépingler" : "Épingler en haut"}
                    >
                      {a.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-[#00E676] hover:bg-[#232D29]"
                      title="Modifier cette annonce"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-rose-400 hover:bg-[#232D29]"
                      title="Supprimer cette annonce"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{a.body}</p>

              {a.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-[#1B2320] bg-[#0D1110]">
                  <img src={a.imageUrl} alt={a.title} className="w-full max-h-80 object-contain" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Formulaire de publication/édition */}
      {isFormOpen && isOwner && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {editingId ? "Modifier l'annonce" : "Nouvelle annonce"}
                </span>
                <h3 className="text-lg font-bold text-white">Publier à toute l'académie</h3>
              </div>
              <button
                onClick={closeForm}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Titre</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="ex : Marché fermé cette semaine"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Message</label>
                <textarea
                  rows={4}
                  value={formData.body}
                  onChange={(e) => setFormData((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Explique ce que les élèves doivent savoir..."
                  className={`${inputClass} resize-none`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Catégorie</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category: e.target.value as AnnouncementCategory }))
                    }
                    className={inputClass}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_EMOJI[cat]} {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Visibilité</label>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, pinned: !prev.pinned }))}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-bold border transition-all ${
                      formData.pinned
                        ? "bg-[#00E676]/15 border-[#00E676] text-[#00E676]"
                        : "bg-[#0D1110] border-[#1B2320] text-slate-400 hover:text-white"
                    }`}
                  >
                    {formData.pinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                    {formData.pinned ? "Épinglée en haut" : "Épingler en haut"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Image <span className="text-slate-600 font-normal">(facultatif)</span>
                </label>
                {formData.imageUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-[#1B2320] group">
                    <img
                      src={formData.imageUrl}
                      alt="Illustration de l'annonce"
                      className="w-full max-h-56 object-contain bg-[#0D1110]"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <label className="px-3 py-1.5 rounded-lg bg-[#1B2320] text-white text-xs font-semibold cursor-pointer hover:bg-[#232D29]">
                        Remplacer
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, imageUrl: "" }))}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/80 text-white text-xs font-semibold hover:bg-rose-500"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <label
                    className={`flex items-center justify-center gap-2 w-full border border-dashed border-[#1B2320] rounded-lg p-4 text-xs text-slate-400 cursor-pointer hover:border-[#00E676]/40 hover:text-slate-200 transition-colors ${
                      isResizingImage ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {isResizingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Traitement de l'image…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="w-4 h-4" />
                        Ajouter une image (JPEG, PNG, WebP)
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isResizingImage}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20"
                >
                  {editingId ? "Enregistrer les modifications" : "Publier à l'académie"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
