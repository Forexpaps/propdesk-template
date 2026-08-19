import React, { useState } from "react";
import {
  Search,
  PlusCircle,
  Pin,
  CheckCircle2,
  Lock,
  ThumbsUp,
  MessageCircle,
  Eye,
  ShieldCheck,
  Award,
  Sparkles,
  ChevronLeft,
  Trash2,
  AlertCircle,
  Filter,
  Send
} from "lucide-react";
import {
  ForumTopic,
  ForumReply,
  ForumCategory,
  ForumRole,
  StudentProfile,
  Coach
} from "../types";
import { confirmDialog } from "../lib/confirmDialog";

interface ForumSectionProps {
  topics: ForumTopic[];
  student: StudentProfile;
  coaches: Coach[];
  onCreateTopic: (newTopic: Omit<ForumTopic, "id" | "createdAt" | "repliesCount" | "viewsCount" | "likesCount" | "isPinned" | "isSolved" | "isLocked" | "replies">) => void;
  onAddReply: (topicId: string, content: string, role?: ForumRole, authorName?: string, isCoachCertified?: boolean) => void;
  onToggleLikeTopic: (topicId: string) => void;
  onToggleLikeReply: (topicId: string, replyId: string) => void;
  onTogglePinTopic: (topicId: string) => void;
  onToggleSolveTopic: (topicId: string) => void;
  onToggleLockTopic: (topicId: string) => void;
  onDeleteTopic: (topicId: string) => void;
}

export const ForumSection: React.FC<ForumSectionProps> = ({
  topics,
  student,
  coaches,
  onCreateTopic,
  onAddReply,
  onToggleLikeTopic,
  onToggleLikeReply,
  onTogglePinTopic,
  onToggleSolveTopic,
  onToggleLockTopic,
  onDeleteTopic,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTabFilter, setActiveTabFilter] = useState<"all" | "unsolved" | "pinned" | "my_topics">("all");
  
  // Selected Topic for Thread View
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // New Topic Modal State
  const [showNewTopicModal, setShowNewTopicModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newCategory, setNewCategory] = useState<ForumCategory>("SMC & Price Action");
  const [newContent, setNewContent] = useState<string>("");

  // Reply Input State
  const [replyText, setReplyText] = useState<string>("");
  const [replyAsCoach, setReplyAsCoach] = useState<boolean>(false);
  const [selectedCoachId, setSelectedCoachId] = useState<string>(coaches[0]?.id || "coach-thomas");

  // Outils de modération (épingler/résoudre/verrouiller/supprimer, répondre
  // en tant que coach) — strictement réservés au staff (`student.isAdmin`).
  // Un élève n'a jamais accès à la bascule ni à son état : impossible de se
  // faire passer pour un coach depuis ce composant, quel que soit l'état.
  const [isModMode, setIsModMode] = useState<boolean>(Boolean(student.isAdmin));
  const canModerate = Boolean(student.isAdmin) && isModMode;

  // Filter Categories
  const categories: string[] = [
    "Tous",
    "SMC & Price Action",
    "Psychologie & Discipline",
    "Risk Management",
    "Analyses de Marché",
    "Questions Générales",
  ];

  // Filtering Logic
  const filteredTopics = topics.filter((t) => {
    const matchesCategory = selectedCategory === "Tous" || t.category === selectedCategory;
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.authorName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesCategory || !matchesSearch) return false;

    if (activeTabFilter === "unsolved") return !t.isSolved;
    if (activeTabFilter === "pinned") return t.isPinned;
    if (activeTabFilter === "my_topics") {
      // `authorEmail` (stable) prime dès qu'il est présent — `authorName`
      // seul confondait deux homonymes et perdait le fil après un
      // renommage de profil. Repli sur `authorName` pour les sujets créés
      // avant l'ajout du champ, qui n'en portent pas.
      return t.authorEmail ? t.authorEmail === student.email : t.authorName === student.name;
    }

    return true;
  });

  const selectedTopic = topics.find((t) => t.id === selectedTopicId);

  // Handle New Topic Submit
  const handleCreateTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    onCreateTopic({
      title: newTitle,
      category: newCategory,
      authorName: student.name,
      authorEmail: student.email,
      authorAvatar: student.avatar,
      authorRole: canModerate ? "Head Coach" : "Élève Premium",
      content: newContent,
    });

    setNewTitle("");
    setNewContent("");
    setShowNewTopicModal(false);
  };

  // Handle Reply Submit
  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopicId || !replyText.trim()) return;

    if (replyAsCoach && canModerate) {
      const coach = coaches.find((c) => c.id === selectedCoachId) || coaches[0];
      onAddReply(selectedTopicId, replyText, "Head Coach", coach.name, true);
    } else {
      onAddReply(selectedTopicId, replyText, "Élève Premium", student.name, false);
    }

    setReplyText("");
  };

  const getCategoryBadgeColor = (cat: ForumCategory) => {
    switch (cat) {
      case "SMC & Price Action":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Psychologie & Discipline":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "Risk Management":
        return "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20";
      case "Analyses de Marché":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
  };

  const getRoleBadge = (role: ForumRole) => {
    if (role === "Head Coach") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950">
          <Award className="w-3 h-3" /> COACH CERTIFIÉ
        </span>
      );
    }
    if (role === "Modérateur") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
          <ShieldCheck className="w-3 h-3 text-purple-400" /> MODÉRATEUR
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1B2320] text-slate-300">
        Élève Premium
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Moderator Switch */}
      <div className="bg-gradient-to-r from-[#111615] via-[#151D1A] to-[#111615] rounded-2xl border border-[#1B2320] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-[#00E676]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold border border-[#00E676]/20">
              <Sparkles className="w-3.5 h-3.5" />
              Forum d'Échange & Entraide Académique
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Espace Communautaire Horizon
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Posez vos questions sur les setups SMC, partagez vos analyses de marché, discutez psychologie et recevez les retours certifiés des coaches et modérateurs.
            </p>
          </div>

          {/* Action Header & Moderator Mode Control — réservé au staff */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {student.isAdmin && (
              <div className="p-3 bg-[#0D1110]/80 border border-[#1B2320] rounded-xl flex items-center gap-3">
                <div className="text-left">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#00E676]" />
                    Espace Modération
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isModMode ? "Outils de gestion activés" : "Vue élève standard"}
                  </div>
                </div>
                <button
                  onClick={() => setIsModMode(!isModMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isModMode ? "bg-[#00E676]" : "bg-[#232D29]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-[#0D1110] transition-transform ${
                      isModMode ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowNewTopicModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#00E676] to-teal-500 hover:from-[#00E676] hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20 transition-all shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau Sujet</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Forum View: List OR Detailed Thread */}
      {selectedTopic ? (
        /* Detailed Thread View */
        <div className="space-y-6">
          {/* Back Button & Thread Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedTopicId(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#111615] border border-[#1B2320] text-slate-300 hover:text-white text-xs font-semibold transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Retour à la liste des sujets</span>
            </button>

            {/* Moderator Action Toolbar for Topic */}
            {canModerate && (
              <div className="flex items-center gap-2 bg-[#111615]/90 p-1.5 rounded-xl border border-[#1B2320]">
                <span className="text-[10px] font-mono text-slate-400 px-2">Modération:</span>
                <button
                  onClick={() => onTogglePinTopic(selectedTopic.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                    selectedTopic.isPinned
                      ? "bg-amber-500 text-slate-950"
                      : "bg-[#1B2320] text-slate-300 hover:bg-[#232D29]"
                  }`}
                  title="Épingler le sujet en haut du forum"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {selectedTopic.isPinned ? "Épinglé" : "Épingler"}
                </button>

                <button
                  onClick={() => onToggleSolveTopic(selectedTopic.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                    selectedTopic.isSolved
                      ? "bg-[#00E676] text-slate-950"
                      : "bg-[#1B2320] text-slate-300 hover:bg-[#232D29]"
                  }`}
                  title="Marquer comme résolu"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedTopic.isSolved ? "Résolu" : "Marquer résolu"}
                </button>

                <button
                  onClick={() => onToggleLockTopic(selectedTopic.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                    selectedTopic.isLocked
                      ? "bg-rose-500 text-slate-950"
                      : "bg-[#1B2320] text-slate-300 hover:bg-[#232D29]"
                  }`}
                  title="Verrouiller les réponses"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {selectedTopic.isLocked ? "Verrouillé" : "Verrouiller"}
                </button>

                <button
                  onClick={async () => {
                    if (
                      await confirmDialog("Voulez-vous vraiment supprimer ce sujet ?", {
                        title: "Supprimer le sujet",
                        confirmLabel: "Supprimer",
                        danger: true,
                      })
                    ) {
                      onDeleteTopic(selectedTopic.id);
                      setSelectedTopicId(null);
                    }
                  }}
                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                  title="Supprimer définitivement"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Original Topic Card */}
          <div className="bg-[#111615] rounded-2xl border border-[#1B2320] p-6 space-y-6 shadow-xl">
            {/* Topic Meta Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-md border font-semibold ${getCategoryBadgeColor(selectedTopic.category)}`}>
                {selectedTopic.category}
              </span>

              {selectedTopic.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                  <Pin className="w-3.5 h-3.5" /> Épinglé par le staff
                </span>
              )}

              {selectedTopic.isSolved && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Résolu
                </span>
              )}

              {selectedTopic.isLocked && (
                <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                  <Lock className="w-3.5 h-3.5" /> Verrouillé
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {selectedTopic.title}
            </h1>

            {/* Author Info Row */}
            <div className="flex items-center justify-between border-y border-[#1B2320]/80 py-3 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <img
                  src={selectedTopic.authorAvatar}
                  alt={selectedTopic.authorName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#00E676]/40"
                />
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-2">
                    <span>{selectedTopic.authorName}</span>
                    {getRoleBadge(selectedTopic.authorRole)}
                  </div>
                  <div className="text-[11px] text-slate-500">Posté {selectedTopic.createdAt}</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-slate-500" /> {selectedTopic.viewsCount} vues
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5 text-slate-500" /> {selectedTopic.repliesCount} réponses
                </span>
              </div>
            </div>

            {/* Content Body */}
            <div className="text-sm text-slate-200 leading-relaxed space-y-4 whitespace-pre-line bg-[#0D1110]/40 p-5 rounded-xl border border-[#1B2320]/60">
              {selectedTopic.content}
            </div>

            {/* Like & Interaction Bar */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => onToggleLikeTopic(selectedTopic.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2320] hover:bg-[#1F2825] text-slate-200 text-xs font-semibold transition-colors"
              >
                <ThumbsUp className="w-4 h-4 text-[#00E676]" />
                <span>J'aime ({selectedTopic.likesCount})</span>
              </button>

              <span className="text-xs text-slate-500">
                {selectedTopic.replies.length} Réponse{selectedTopic.replies.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Replies Thread List */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[#00E676]" />
              Réponses de la communauté ({selectedTopic.replies.length})
            </h2>

            {selectedTopic.replies.map((reply) => (
              <div
                key={reply.id}
                className={`p-5 rounded-2xl border transition-all ${
                  reply.isSolution
                    ? "bg-[#111615]/90 border-[#00E676]/50 shadow-lg shadow-[#00E676]/5 ring-1 ring-[#00E676]/30"
                    : reply.isCoachCertified
                    ? "bg-[#111615]/90 border-amber-500/40"
                    : "bg-[#111615]/70 border-[#1B2320]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={reply.authorAvatar}
                      alt={reply.authorName}
                      className="w-9 h-9 rounded-full object-cover border-2 border-[#00E676]/30"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{reply.authorName}</span>
                        {getRoleBadge(reply.authorRole)}
                        {reply.isSolution && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#00E676] text-slate-950">
                            <CheckCircle2 className="w-3 h-3" /> SOLUTION VALIDÉE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">{reply.createdAt}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onToggleLikeReply(selectedTopic.id, reply.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1B2320]/80 hover:bg-[#1B2320] text-slate-300 text-xs transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-[#00E676]" />
                    <span>{reply.likesCount}</span>
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-line pl-12">
                  {reply.content}
                </p>
              </div>
            ))}
          </div>

          {/* Reply Form Box */}
          {selectedTopic.isLocked ? (
            <div className="p-4 rounded-xl bg-[#111615] border border-[#1B2320] text-center text-xs text-rose-400 flex items-center justify-center gap-2 font-medium">
              <Lock className="w-4 h-4" /> Ce sujet a été verrouillé par un modérateur. Les réponses sont fermées.
            </div>
          ) : (
            <form onSubmit={handleReplySubmit} className="bg-[#111615] rounded-2xl border border-[#1B2320] p-5 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#00E676]" />
                  Répondre à cette discussion
                </h3>

                {/* Switch to Reply as Coach if Mod Mode */}
                {canModerate && (
                  <div className="flex items-center gap-2 text-xs bg-[#0D1110] p-1.5 rounded-lg border border-[#1B2320]">
                    <span className="text-slate-400">Poste en tant que :</span>
                    <select
                      value={replyAsCoach ? selectedCoachId : "student"}
                      onChange={(e) => {
                        if (e.target.value === "student") {
                          setReplyAsCoach(false);
                        } else {
                          setReplyAsCoach(true);
                          setSelectedCoachId(e.target.value);
                        }
                      }}
                      className="bg-[#111615] border border-[#232D29] text-xs text-amber-400 rounded px-2 py-1 font-bold focus:outline-none"
                    >
                      <option value="student">Élève ({student.name})</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          Coach: {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Rédigez votre réponse construite, courtoise et argumentée..."
                rows={3}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00E676] transition-colors"
              />

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-500">
                  Respectez la charte d'entraide Horizon Trading.
                </p>
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00E676] disabled:opacity-50 text-slate-950 font-bold text-xs shadow-lg shadow-[#00E676]/20 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  Publier la réponse
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Forum Topics List View */
        <div className="space-y-6">
          {/* Search, Category Filters & Sub-Tabs Bar */}
          <div className="bg-[#111615] rounded-2xl border border-[#1B2320] p-4 space-y-4">
            {/* Search and Quick Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher une question, un mot clé, un coach..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#00E676] transition-colors"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setActiveTabFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTabFilter === "all"
                      ? "bg-[#00E676] text-slate-950 font-bold shadow"
                      : "bg-[#0D1110] text-slate-400 hover:text-white hover:bg-[#1B2320]"
                  }`}
                >
                  Tous ({topics.length})
                </button>

                <button
                  onClick={() => setActiveTabFilter("unsolved")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTabFilter === "unsolved"
                      ? "bg-amber-500 text-slate-950 font-bold shadow"
                      : "bg-[#0D1110] text-slate-400 hover:text-white hover:bg-[#1B2320]"
                  }`}
                >
                  Non Résolus
                </button>

                <button
                  onClick={() => setActiveTabFilter("pinned")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTabFilter === "pinned"
                      ? "bg-amber-500 text-slate-950 font-bold shadow"
                      : "bg-[#0D1110] text-slate-400 hover:text-white hover:bg-[#1B2320]"
                  }`}
                >
                  Épinglés
                </button>

                <button
                  onClick={() => setActiveTabFilter("my_topics")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTabFilter === "my_topics"
                      ? "bg-purple-500 text-white font-bold shadow"
                      : "bg-[#0D1110] text-slate-400 hover:text-white hover:bg-[#1B2320]"
                  }`}
                >
                  Mes Sujets
                </button>
              </div>
            </div>

            {/* Category Pills Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[#1B2320]/80 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-[#1B2320] text-[#00E676] border border-[#00E676]/40 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#0D1110]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Topics Card List */}
          <div className="space-y-3">
            {filteredTopics.length === 0 ? (
              <div className="bg-[#111615] rounded-2xl border border-[#1B2320] p-12 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="text-base font-bold text-white">Aucun sujet trouvé</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Aucune discussion ne correspond à vos filtres actuels. Soyez le premier à poser une question !
                </p>
                <button
                  onClick={() => setShowNewTopicModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00E676] text-slate-950 font-bold text-xs"
                >
                  <PlusCircle className="w-4 h-4" /> Créer un sujet
                </button>
              </div>
            ) : (
              filteredTopics.map((topic) => (
                <div
                  key={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`group bg-[#111615]/90 hover:bg-[#151D1A] rounded-2xl border p-5 transition-all cursor-pointer shadow-lg hover:shadow-xl ${
                    topic.isPinned
                      ? "border-amber-500/40 bg-[#111615]/95"
                      : "border-[#1B2320] hover:border-[#232D29]"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left Main Topic Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getCategoryBadgeColor(topic.category)}`}>
                          {topic.category}
                        </span>

                        {topic.isPinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Pin className="w-3 h-3" /> ÉPINGLÉ
                          </span>
                        )}

                        {topic.isSolved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/30">
                            <CheckCircle2 className="w-3 h-3" /> RÉSOLU
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Ouvert</span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-[#00E676] transition-colors line-clamp-2">
                        {topic.title}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                        <div className="flex items-center gap-2">
                          <img
                            src={topic.authorAvatar}
                            alt={topic.authorName}
                            className="w-5 h-5 rounded-full object-cover border border-[#00E676]/30"
                          />
                          <span className="text-slate-300 font-medium">{topic.authorName}</span>
                          {getRoleBadge(topic.authorRole)}
                        </div>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500 text-[11px]">{topic.createdAt}</span>
                      </div>
                    </div>

                    {/* Right Reply Stats & Like Pills */}
                    <div className="flex items-center gap-4 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#1B2320]">
                      <div className="text-center px-3 py-1.5 rounded-xl bg-[#0D1110] border border-[#1B2320] min-w-[64px]">
                        <div className="text-sm font-bold text-white font-mono">{topic.repliesCount}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">Réponses</div>
                      </div>

                      <div className="text-center px-3 py-1.5 rounded-xl bg-[#0D1110] border border-[#1B2320] min-w-[64px]">
                        <div className="text-sm font-bold text-[#00E676] font-mono">{topic.likesCount}</div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider">J'aime</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Topic Modal */}
      {showNewTopicModal && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-[#00E676] uppercase tracking-wider">
                  Nouveau Sujet de Discussion
                </span>
                <h3 className="text-lg font-bold text-white">Poser une question à la communauté</h3>
              </div>
              <button
                onClick={() => setShowNewTopicModal(false)}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTopicSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Titre du Sujet *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Validation d'un Order Block M5 sur EUR/USD..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E676] transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Catégorie *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ForumCategory)}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#00E676] transition-colors font-medium"
                >
                  <option value="SMC & Price Action">SMC & Price Action</option>
                  <option value="Psychologie & Discipline">Psychologie & Discipline</option>
                  <option value="Risk Management">Risk Management & Capital</option>
                  <option value="Analyses de Marché">Analyses de Marché</option>
                  <option value="Questions Générales">Questions Générales</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Description Détaillée *</label>
                <textarea
                  required
                  rows={5}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Expliquez clairement votre question, le contexte de votre trade, la paire et la timeframe..."
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00E676] transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2320]">
                <button
                  type="button"
                  onClick={() => setShowNewTopicModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#00E676] hover:bg-[#00E676] text-slate-950 font-extrabold text-xs shadow-lg shadow-[#00E676]/20 transition-all"
                >
                  Créer le Sujet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
