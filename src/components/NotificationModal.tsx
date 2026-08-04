import React, { useState } from "react";
import { Bell, CheckCheck, Trash2, Zap, ArrowRight, ShieldAlert, Sparkles, BookOpen, Volume2, VolumeX, X, AlertCircle } from "lucide-react";
import { AppNotification } from "../types";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onNavigateToTab?: (tab: string) => void;
  onAddTestNotification?: () => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onNavigateToTab,
  onAddTestNotification,
}) => {
  const [filter, setFilter] = useState<"all" | "unread" | "signal" | "risk" | "academy">("all");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("horizon_sound_alerts");
    return saved !== null ? JSON.parse(saved) : true;
  });

  if (!isOpen) return null;

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("horizon_sound_alerts", JSON.stringify(next));
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "signal") return n.type === "signal";
    if (filter === "risk") return n.type === "risk" || n.type === "trade";
    if (filter === "academy") return n.type === "academy";
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: AppNotification) => {
    onMarkAsRead(n.id);
    if (n.targetTab && onNavigateToTab) {
      onNavigateToTab(n.targetTab);
      onClose();
    }
  };

  const getNotificationIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "signal":
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case "trade":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "risk":
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case "academy":
        return <BookOpen className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-end p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border-l sm:border border-slate-800 w-full sm:max-w-md h-full sm:h-[88vh] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center border border-slate-950">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Centre d'Alertes SMC
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                    {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">Signaux coach, jalons académie & risques</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-500 border-slate-700"
              }`}
              title={soundEnabled ? "Sons d'alerte activés" : "Sons d'alerte coupés"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar & Quick Filters */}
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "all" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "unread" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Non Lues ({unreadCount})
            </button>
            <button
              onClick={() => setFilter("signal")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "signal" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Signaux
            </button>
            <button
              onClick={() => setFilter("risk")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "risk" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Risque & Trades
            </button>
            <button
              onClick={() => setFilter("academy")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "academy" ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              Académie
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
            <button
              onClick={onMarkAllAsRead}
              className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme lu
            </button>

            {onAddTestNotification && (
              <button
                onClick={onAddTestNotification}
                className="text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 hover:underline"
              >
                <Zap className="w-3.5 h-3.5" /> Simuler alerte live
              </button>
            )}

            <button
              onClick={onClearAll}
              className="text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" /> Effacer
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
              <AlertCircle className="w-10 h-10 stroke-1 opacity-50 text-slate-400" />
              <p className="text-xs font-medium text-slate-400">Aucune notification disponible dans cette catégorie</p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3 rounded-xl border transition-all cursor-pointer group relative ${
                  !n.read
                    ? "bg-slate-850/90 border-amber-500/40 hover:border-amber-400"
                    : "bg-slate-950/40 border-slate-800/80 opacity-80 hover:opacity-100 hover:border-slate-700"
                }`}
              >
                {!n.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                )}

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 space-y-1 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                        {n.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>{n.time}</span>
                      {n.targetTab && (
                        <span className="text-amber-400 font-mono flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                          Voir la section <ArrowRight className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Horizon SMC Push Server: <strong className="text-emerald-400 font-mono">Connecté (Live)</strong></span>
          <span className="font-mono text-[10px] text-slate-500">v2.4.0</span>
        </div>
      </div>
    </div>
  );
};
