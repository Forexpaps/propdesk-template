import React, { useState } from "react";
import { Bell, CheckCheck, Trash2, Zap, ArrowRight, ShieldAlert, Sparkles, Volume2, VolumeX, X, AlertCircle } from "lucide-react";
import { AppNotification } from "../types";
import { usePersistentState } from "../hooks/usePersistentState";

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
  const [filter, setFilter] = useState<"all" | "unread" | "risk">("all");
  const [soundEnabled, setSoundEnabled] = usePersistentState<boolean>(
    "horizon_sound_alerts",
    true
  );

  if (!isOpen) return null;

  const toggleSound = () => setSoundEnabled((prev) => !prev);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "risk") return n.type === "risk" || n.type === "trade";
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
        return <Zap className="w-4 h-4 text-[#00E676]" />;
      case "trade":
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case "risk":
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-end p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111615] border-l sm:border border-[#1B2320] w-full sm:max-w-md h-full sm:h-[88vh] sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 border-b border-[#1B2320] bg-[#0D1110]/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20 relative">
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00E676] text-slate-950 font-bold text-[10px] rounded-full flex items-center justify-center border border-[#151D1A]">
                  {unreadCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Centre d'alerte
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#00E676]/10 text-[#00E676] text-[10px] font-mono border border-[#00E676]/20">
                    {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              className={`p-1.5 rounded-lg border transition-colors ${
                soundEnabled
                  ? "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30"
                  : "bg-[#1B2320] text-slate-500 border-[#232D29]"
              }`}
              title={soundEnabled ? "Sons d'alerte activés" : "Sons d'alerte coupés"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1B2320] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar & Quick Filters */}
        <div className="p-3 bg-[#0D1110]/50 border-b border-[#1B2320] space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "all" ? "bg-[#00E676] text-slate-950 font-bold" : "bg-[#1B2320] text-slate-400 hover:text-white"
              }`}
            >
              Toutes ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "unread" ? "bg-[#00E676] text-slate-950 font-bold" : "bg-[#1B2320] text-slate-400 hover:text-white"
              }`}
            >
              Non Lues ({unreadCount})
            </button>
            <button
              onClick={() => setFilter("risk")}
              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                filter === "risk" ? "bg-[#00E676] text-slate-950 font-bold" : "bg-[#1B2320] text-slate-400 hover:text-white"
              }`}
            >
              Risque & Trades
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#1B2320]/60">
            <button
              onClick={onMarkAllAsRead}
              className="text-[#00E676] hover:text-[#69F0AE] font-medium flex items-center gap-1 hover:underline"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Tout marquer comme lu
            </button>

            {onAddTestNotification && (
              <button
                onClick={onAddTestNotification}
                className="text-[#00E676] hover:text-[#69F0AE] font-medium flex items-center gap-1 hover:underline"
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
                    ? "bg-[#151D1A]/90 border-[#00E676]/40 hover:border-[#00E676]"
                    : "bg-[#0D1110]/40 border-[#1B2320]/80 opacity-80 hover:opacity-100 hover:border-[#232D29]"
                }`}
              >
                {!n.read && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#00E676] shadow-[0_0_8px_#00E676]" />
                )}

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[#111615] border border-[#1B2320] shrink-0 mt-0.5">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 space-y-1 pr-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-white group-hover:text-[#00E676] transition-colors">
                        {n.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>{n.time}</span>
                      {n.targetTab && (
                        <span className="text-[#00E676] font-mono flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
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
        <div className="p-3 bg-[#0D1110] border-t border-[#1B2320] text-[11px] text-slate-400 flex items-center justify-between">
          <span>PropDesk Push Server: <strong className="text-[#00E676] font-mono">Connecté (Live)</strong></span>
          <span className="font-mono text-[10px] text-slate-500">v2.4.0</span>
        </div>
      </div>
    </div>
  );
};
