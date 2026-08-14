import React from "react";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  /** Bandeau d'information affiché au-dessus du formulaire. */
  notice?: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Coque commune aux écrans de connexion et de première installation.
 *
 * Toute la palette de ces écrans vit ici, une seule fois. Les deux écrans
 * diffèrent assez (libellés, `autocomplete`, validation, erreurs) pour rester
 * deux composants distincts, mais leur habillage est identique.
 */
export const AuthShell: React.FC<AuthShellProps> = ({
  title,
  subtitle,
  children,
  notice,
  footer,
}) => (
  <div className="min-h-screen bg-[#0B0F0E] text-slate-100 font-sans antialiased selection:bg-[#00E676] selection:text-slate-950 flex flex-col items-center justify-center p-4">
    <div className="w-full max-w-md space-y-6">
      {/* Le logo n'est pas décoratif : il identifie le service sur lequel on
          s'apprête à saisir un mot de passe. PNG à fond transparent (recadré
          depuis l'ancien logo-auth.jpg, qui portait un badge sombre en dur
          autour du "P") : s'intègre directement au fond de la page, sans
          rectangle ni coins arrondis à gérer côté CSS. */}
      <img
        src="/logo-auth.png"
        alt="PropDesk"
        width={768}
        height={512}
        fetchPriority="high"
        className="w-56 h-auto mx-auto"
      />

      <div className="bg-[#111615] border border-[#1B2320] rounded-2xl p-8 space-y-6 shadow-2xl">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <p className="text-xs text-slate-400 leading-relaxed">{subtitle}</p>
        </div>

        {notice}

        {children}
      </div>

      {footer && <div className="text-center text-[11px] text-slate-500">{footer}</div>}
    </div>
  </div>
);

/** Champ de saisie aux styles communs des deux écrans. */
export const AuthField: React.FC<{
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ id, label, hint, children }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs font-medium text-slate-300">
      {label}
    </label>
    {children}
    {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
  </div>
);

export const AUTH_INPUT_CLASS =
  "w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#00E676] transition-colors read-only:opacity-60";

export const AUTH_BUTTON_CLASS =
  "w-full rounded-xl bg-[#00E676] hover:bg-[#00c865] disabled:opacity-60 disabled:hover:bg-[#00E676] text-slate-950 font-bold text-sm py-2.5 transition-colors";

/**
 * Zone d'erreur.
 *
 * `role="alert"` la fait annoncer par les lecteurs d'écran sans déplacer le
 * focus, ce qui laisse l'utilisateur dans le champ qu'il corrigeait.
 */
export const AuthError: React.FC<{ id: string; message: string }> = ({ id, message }) => (
  <div
    id={id}
    role="alert"
    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200"
  >
    {message}
  </div>
);
