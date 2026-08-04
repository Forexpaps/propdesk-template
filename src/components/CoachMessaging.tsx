import React, { useState } from "react";
import {
  Send,
  Paperclip,
  Sparkles,
  Bot,
  User,
  CheckCheck,
  Clock,
  MessageSquare,
  Award,
  BookOpen,
  FileText,
  Star,
  Zap,
  ArrowUpRight,
  ShieldCheck
} from "lucide-react";
import { Coach, CoachMessage, Trade, StudentProfile } from "../types";

interface CoachMessagingProps {
  coaches: Coach[];
  messages: CoachMessage[];
  student: StudentProfile;
  trades: Trade[];
  onSendMessage: (
    coachId: string,
    text: string,
    attachedTradeId?: string,
    attachedModuleTitle?: string,
    triggerAiReply?: boolean
  ) => Promise<void>;
  prefilledLessonTitle?: string;
  prefilledTradeId?: string;
}

export const CoachMessaging: React.FC<CoachMessagingProps> = ({
  coaches,
  messages,
  student,
  trades,
  onSendMessage,
  prefilledLessonTitle,
  prefilledTradeId,
}) => {
  const [selectedCoachId, setSelectedCoachId] = useState<string>("coach-thomas");
  const [inputText, setInputText] = useState<string>(
    prefilledLessonTitle
      ? `Bonjour Coach, j'ai une question concernant la leçon "${prefilledLessonTitle}" : `
      : ""
  );
  const [selectedTradeAttachment, setSelectedTradeAttachment] = useState<string>(
    prefilledTradeId || ""
  );
  const [isAiCoachMode, setIsAiCoachMode] = useState<boolean>(true);
  const [isSending, setIsSending] = useState<boolean>(false);

  const selectedCoach = coaches.find((c) => c.id === selectedCoachId) || coaches[0];
  const activeConversation = messages.filter((m) => m.coachId === selectedCoachId);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedTradeAttachment) return;

    setIsSending(true);
    try {
      await onSendMessage(
        selectedCoachId,
        inputText,
        selectedTradeAttachment || undefined,
        prefilledLessonTitle,
        isAiCoachMode
      );
      setInputText("");
      setSelectedTradeAttachment("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
            <MessageSquare className="w-3.5 h-3.5" />
            Messagerie Privée Directe & Asynchrone
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Espace d'Échange Élève → Coachs
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-2xl">
            Posez vos questions sur vos cours, demandez un avis sur un trade spécifique ou recevez des conseils psychologiques personnalisés.
          </p>
        </div>

        {/* AI Quick Response Toggle */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3 shrink-0">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-xs">
            <div className="font-bold text-slate-200 flex items-center gap-1.5">
              Réponse IA Immédiate
            </div>
            <p className="text-[10px] text-slate-400">Activer le double coach Gemini</p>
          </div>
          <input
            type="checkbox"
            checked={isAiCoachMode}
            onChange={(e) => setIsAiCoachMode(e.target.checked)}
            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Main Messaging Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        {/* Left Sidebar: Coaches List */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2">
            Vos Coachs Référents
          </h2>

          <div className="space-y-2">
            {coaches.map((coach) => {
              const isSelected = coach.id === selectedCoachId;
              return (
                <div
                  key={coach.id}
                  onClick={() => setSelectedCoachId(coach.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-800/90 border-amber-500/50 shadow-md"
                      : "bg-slate-950/40 border-slate-850 hover:bg-slate-850/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={coach.avatar}
                        alt={coach.name}
                        className="w-11 h-11 rounded-full object-cover border-2 border-slate-700"
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          coach.isOnline ? "bg-emerald-400" : "bg-slate-500"
                        }`}
                      />
                    </div>

                    <div className="space-y-0.5 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-white truncate">{coach.name}</h3>
                        <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-400" />
                          {coach.rating}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300 font-medium truncate">{coach.role}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{coach.specialty}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Chat Area */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl">
          {/* Active Coach Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={selectedCoach.avatar}
                alt={selectedCoach.name}
                className="w-10 h-10 rounded-full object-cover border border-amber-500/40"
              />
              <div>
                <h3 className="text-sm font-bold text-white">{selectedCoach.name}</h3>
                <div className="text-xs text-amber-400 font-medium flex items-center gap-2">
                  <span>{selectedCoach.specialty}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    En ligne
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages Thread Container */}
          <div className="p-6 space-y-4 overflow-y-auto max-h-[460px] min-h-[380px] bg-slate-950/30">
            {activeConversation.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-xs">
                  Aucun message échangé pour le moment avec {selectedCoach.name}.
                </p>
                <p className="text-slate-500 text-[11px]">
                  Posez votre première question ci-dessous !
                </p>
              </div>
            ) : (
              activeConversation.map((msg) => {
                const isStudent = msg.sender === "student";
                const attachedTrade = msg.attachedTradeId
                  ? trades.find((t) => t.id === msg.attachedTradeId)
                  : null;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isStudent ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-xl p-4 rounded-2xl space-y-3 shadow-md ${
                        isStudent
                          ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 rounded-br-none"
                          : "bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-none"
                      }`}
                    >
                      {/* Attached Trade Card Preview */}
                      {attachedTrade && (
                        <div
                          className={`p-3 rounded-xl text-xs space-y-1 font-mono border ${
                            isStudent
                              ? "bg-slate-950/20 text-slate-950 border-slate-950/20"
                              : "bg-slate-950/60 text-slate-200 border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span>📌 Trade rattaché : {attachedTrade.pair} ({attachedTrade.direction})</span>
                            <span className={attachedTrade.pnl >= 0 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                              {attachedTrade.pnl} €
                            </span>
                          </div>
                          <div className="text-[11px] opacity-80">
                            Entrée: {attachedTrade.entryPrice} | SL: {attachedTrade.stopLoss} | Strategy: {attachedTrade.strategy}
                          </div>
                        </div>
                      )}

                      {/* Lesson Context */}
                      {msg.attachedModuleTitle && (
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 text-xs border border-indigo-500/20 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>Question concernant: <strong>{msg.attachedModuleTitle}</strong></span>
                        </div>
                      )}

                      {/* Message Body */}
                      <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </p>

                      {/* Timestamp & Status */}
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] ${
                          isStudent ? "text-slate-900/80" : "text-slate-400"
                        }`}
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>{msg.timestamp}</span>
                        {isStudent && <CheckCheck className="w-3 h-3 ml-1" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse py-2">
                <Sparkles className="w-4 h-4" />
                <span>Le Coach réfléchit et rédige sa réponse...</span>
              </div>
            )}
          </div>

          {/* Composer Input Bar */}
          <form onSubmit={handleSend} className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
            {/* Attachment Selector Row */}
            <div className="flex items-center gap-3 overflow-x-auto text-xs">
              <span className="text-slate-500 text-[11px] font-semibold shrink-0">Rattacher un Trade :</span>
              <select
                value={selectedTradeAttachment}
                onChange={(e) => setSelectedTradeAttachment(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300 text-xs focus:outline-none"
              >
                <option value="">-- Aucun trade rattaché --</option>
                {trades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.date} - {t.pair} ({t.direction}) [{t.pnl} €]
                  </option>
                ))}
              </select>
            </div>

            {/* Input Row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Rédigez votre message à ${selectedCoach.name}...`}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />

              <button
                type="submit"
                disabled={isSending || (!inputText.trim() && !selectedTradeAttachment)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Envoyer</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
