import React, { useRef, useState } from "react";
import {
  PlayCircle,
  CheckCircle2,
  Circle,
  FileText,
  Download,
  HelpCircle,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  Search,
  Zap,
  ShieldCheck,
  Brain,
  Compass,
  TrendingUp,
  Check,
  RotateCcw,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  BookText,
  Upload,
  ClipboardList,
  Wallet,
  Layers,
  History,
  Percent,
  Target,
  Eye,
  EyeOff,
} from "lucide-react";
import { Module, Lesson, QuizQuestion, ModuleQuizResult, CourseLevel } from "../types";
import { confirmDialog } from "../lib/confirmDialog";
import { api } from "../lib/api";

const SectionHeader: React.FC<{ children?: React.ReactNode; color?: string }> = ({
  children,
  color = "bg-[#00E676]",
}) => (
  <span className="inline-flex items-center gap-2">
    <span className={`w-1 h-4 rounded-full ${color} shrink-0`} />
    {children}
  </span>
);

interface VideoAcademyProps {
  modules: Module[];
  quizResults: Record<string, ModuleQuizResult>;
  onToggleLessonCompletion: (moduleId: string, lessonId: string) => void;
  onAskCoachAboutLesson: (lessonTitle: string) => void;
  onSaveModuleQuizResult: (moduleId: string, result: ModuleQuizResult) => void;
  /**
   * Édition du programme — réservée au staff (voir `App.tsx`, qui ne passe
   * ces callbacks que sur l'instance staff, jamais sur celle de l'élève).
   * `isAdmin` gouverne uniquement l'AFFICHAGE des contrôles ; l'autorisation
   * réelle reste vérifiée côté serveur (collection "modules", bureau
   * partagé — voir `resolveCollectionUserId`, `server/routes.ts`).
   */
  isAdmin?: boolean;
  onSaveModule?: (module: Module) => void;
  onDeleteModule?: (moduleId: string) => void;
  onSaveLesson?: (moduleId: string, lesson: Lesson) => void;
  onDeleteLesson?: (moduleId: string, lessonId: string) => void;
}

const COURSE_LEVELS: CourseLevel[] = ["Débutant", "Intermédiaire", "Confirmé"];

/**
 * Rang pédagogique de chaque niveau — sert à trier la liste des modules
 * (voir `filteredModules` plus bas), jamais leur ORDRE DE CRÉATION (qui n'a
 * aucune signification pédagogique : un module "Confirmé" peut très bien
 * être créé avant un module "Débutant").
 */
const COURSE_LEVEL_ORDER: Record<CourseLevel, number> = {
  Débutant: 0,
  Intermédiaire: 1,
  Confirmé: 2,
};
const MODULE_ICON_NAMES = [
  "BookOpen",
  "TrendingUp",
  "ClipboardList",
  "Brain",
  "Wallet",
  "ShieldCheck",
  "Layers",
  "History",
  "Percent",
  "Compass",
  "Target",
  "Zap",
  "FileText",
];

type ModuleFormState = {
  title: string;
  category: CourseLevel;
  iconName: string;
  description: string;
  durationTotal: string;
};

type LessonFormState = {
  title: string;
  duration: string;
  videoUrl: string;
  description: string;
  theory: string;
};

const emptyModuleForm: ModuleFormState = {
  title: "",
  category: "Débutant",
  iconName: "BookOpen",
  description: "",
  durationTotal: "",
};

const emptyLessonForm: LessonFormState = {
  title: "",
  duration: "",
  videoUrl: "",
  description: "",
  theory: "",
};

export const VideoAcademy: React.FC<VideoAcademyProps> = ({
  modules,
  quizResults,
  onToggleLessonCompletion,
  onAskCoachAboutLesson,
  onSaveModuleQuizResult,
  isAdmin = false,
  onSaveModule,
  onDeleteModule,
  onSaveLesson,
  onDeleteLesson,
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>("Tous");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({
    "mod-1": true,
    "mod-2": true,
  });

  // Player Modal state
  const [activeLessonModal, setActiveLessonModal] = useState<{
    module: Module;
    lesson: Lesson;
  } | null>(null);

  // Module Quiz Modal state
  const [activeModuleQuizModal, setActiveModuleQuizModal] = useState<Module | null>(null);

  // Lesson Quiz Modal state
  const [activeLessonQuizModal, setActiveLessonQuizModal] = useState<{
    lessonTitle: string;
    quiz: QuizQuestion[];
  } | null>(null);

  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);

  // Édition de module (staff) — `null` fermé, `"new"` création, sinon l'id
  // du module en cours de modification.
  const [moduleEditTarget, setModuleEditTarget] = useState<string | "new" | null>(null);
  const [moduleForm, setModuleForm] = useState<ModuleFormState>(emptyModuleForm);

  // Édition de leçon (staff) — `moduleId` porte toujours le module parent,
  // `lessonId` est `"new"` pour une création, sinon l'id de la leçon éditée.
  const [lessonEditTarget, setLessonEditTarget] = useState<{ moduleId: string; lessonId: string | "new" } | null>(
    null
  );
  const [lessonForm, setLessonForm] = useState<LessonFormState>(emptyLessonForm);

  // Téléversement de vidéo (voir server/uploads.ts) — `null` : rien en
  // cours. `videoFileInputRef` reste caché, déclenché par le bouton
  // "Téléverser" (input file natif stylé nulle part n'étant pas fiable).
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [videoUploadPercent, setVideoUploadPercent] = useState<number | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const handleVideoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de retéléverser le même fichier après une erreur
    if (!file) return;

    setVideoUploadError(null);
    setVideoUploadPercent(0);
    try {
      const { url } = await api.uploadLessonVideo(file, setVideoUploadPercent);
      setLessonForm((f) => ({ ...f, videoUrl: url }));
    } catch (err) {
      setVideoUploadError((err as Error).message || "Le téléversement a échoué.");
    } finally {
      setVideoUploadPercent(null);
    }
  };

  const openNewModuleForm = () => {
    setModuleForm(emptyModuleForm);
    setModuleEditTarget("new");
  };

  const openEditModuleForm = (module: Module) => {
    setModuleForm({
      title: module.title,
      category: module.category,
      iconName: module.iconName,
      description: module.description,
      durationTotal: module.durationTotal,
    });
    setModuleEditTarget(module.id);
  };

  const handleSubmitModuleForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveModule || !moduleEditTarget || !moduleForm.title.trim()) return;
    const id = moduleEditTarget === "new" ? `mod-${Date.now()}` : moduleEditTarget;
    const existing = modules.find((m) => m.id === id);
    onSaveModule({
      id,
      title: moduleForm.title.trim(),
      category: moduleForm.category,
      iconName: moduleForm.iconName,
      description: moduleForm.description.trim(),
      durationTotal: moduleForm.durationTotal.trim() || "0 min",
      lessons: existing?.lessons ?? [],
      quiz: existing?.quiz,
    });
    setModuleEditTarget(null);
  };

  const handleDeleteModuleClick = async (module: Module) => {
    if (!onDeleteModule) return;
    if (
      !(await confirmDialog(
        `Supprimer le module « ${module.title} » et ses ${module.lessons.length} leçon(s) ? Chaque élève perdra sa progression sur ce module.`,
        { title: "Supprimer un module", confirmLabel: "Supprimer", danger: true }
      ))
    ) {
      return;
    }
    onDeleteModule(module.id);
  };

  const openNewLessonForm = (moduleId: string) => {
    setLessonForm(emptyLessonForm);
    setVideoUploadError(null);
    setLessonEditTarget({ moduleId, lessonId: "new" });
  };

  const openEditLessonForm = (moduleId: string, lesson: Lesson) => {
    setLessonForm({
      title: lesson.title,
      duration: lesson.duration,
      videoUrl: lesson.videoUrl ?? "",
      description: lesson.description,
      theory: lesson.theory ?? "",
    });
    setVideoUploadError(null);
    setLessonEditTarget({ moduleId, lessonId: lesson.id });
  };

  const handleSubmitLessonForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveLesson || !lessonEditTarget || !lessonForm.title.trim()) return;
    const { moduleId, lessonId } = lessonEditTarget;
    const module = modules.find((m) => m.id === moduleId);
    const id = lessonId === "new" ? `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : lessonId;
    const existing = module?.lessons.find((l) => l.id === id);
    onSaveLesson(moduleId, {
      id,
      title: lessonForm.title.trim(),
      duration: lessonForm.duration.trim() || "0 min",
      videoUrl: lessonForm.videoUrl.trim() || undefined,
      description: lessonForm.description.trim(),
      theory: lessonForm.theory.trim() || undefined,
      isCompleted: existing?.isCompleted ?? false,
      resources: existing?.resources,
      quiz: existing?.quiz,
    });
    setLessonEditTarget(null);
  };

  const handleDeleteLessonClick = async (moduleId: string, lesson: Lesson) => {
    if (!onDeleteLesson) return;
    if (
      !(await confirmDialog(`Supprimer la leçon « ${lesson.title} » ?`, {
        title: "Supprimer une leçon",
        confirmLabel: "Supprimer",
        danger: true,
      }))
    ) {
      return;
    }
    onDeleteLesson(moduleId, lesson.id);
  };

  // Modules masqués par le staff : invisibles côté élève, toujours visibles
  // (et basculables) côté staff.
  const visibleModules = modules.filter((m) => isAdmin || !m.hidden);

  // Calculate Progress Stats
  const totalLessons = visibleModules.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessonsCount = visibleModules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const globalProgress = totalLessons > 0 ? Math.round((completedLessonsCount / totalLessons) * 100) : 0;

  const toggleModuleExpand = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const getModuleIcon = (iconName: string) => {
    switch (iconName) {
      case "Compass":
        return <Compass className="w-5 h-5 text-teal-400" />;
      case "TrendingUp":
        return <TrendingUp className="w-5 h-5 text-blue-400" />;
      case "Zap":
        return <Zap className="w-5 h-5 text-purple-400" />;
      case "ShieldCheck":
        return <ShieldCheck className="w-5 h-5 text-cyan-400" />;
      case "Brain":
        return <Brain className="w-5 h-5 text-rose-400" />;
      // Plan/routine, checklist de règles à suivre — Trading Plan & Routine.
      case "ClipboardList":
        return <ClipboardList className="w-5 h-5 text-lime-400" />;
      // Capital, gestion du risque en argent — Money Management.
      case "Wallet":
        return <Wallet className="w-5 h-5 text-[#00E676]" />;
      // Structure de marché en couches/niveaux — SMC (order blocks, FVG).
      case "Layers":
        return <Layers className="w-5 h-5 text-indigo-400" />;
      // Regarder en arrière — Backtesting.
      case "History":
        return <History className="w-5 h-5 text-orange-400" />;
      // Statistiques, espérance mathématique — Probabilité.
      case "Percent":
        return <Percent className="w-5 h-5 text-violet-400" />;
      case "Target":
        return <Target className="w-5 h-5 text-red-400" />;
      // Documents, déclarations — Fiscalité & Statut du Trader.
      case "FileText":
        return <FileText className="w-5 h-5 text-sky-400" />;
      default:
        return <BookOpen className="w-5 h-5 text-amber-400" />;
    }
  };

  const filteredModules = visibleModules
    .filter((m) => {
      const matchesLevel = selectedLevel === "Tous" || m.category === selectedLevel;
      const matchesSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.lessons.some((l) => l.title.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesLevel && matchesSearch;
    })
    // Toujours Débutant → Intermédiaire → Confirmé → Masterclass, quel que
    // soit l'ordre dans lequel les modules ont été créés — tri stable :
    // deux modules du même niveau gardent leur ordre relatif d'origine.
    .sort((a, b) => COURSE_LEVEL_ORDER[a.category] - COURSE_LEVEL_ORDER[b.category]);

  const handleQuizAnswerSelect = (questionId: string, optionIndex: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner & Progression Bar */}
      <div className="bg-[#111615] rounded-xl border border-[#1B2320] p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold border border-[#00E676]/20">
              <Sparkles className="w-3.5 h-3.5" />
              Espace Formation Académie SMC
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Parcours d'Apprentissage & Suivi d'Avancement
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Visionnez les leçons vidéo, téléchargez les fiches stratégiques et validez chaque module pour passer du statut de novice à celui de trader institutionnel rentable.
            </p>
          </div>

          {/* Global Progress Box */}
          <div className="bg-[#0D1110] border border-[#1B2320] rounded-xl p-4 min-w-[280px] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Progression Globale</span>
              <span className="text-[#00E676] font-black font-mono text-sm">{globalProgress}%</span>
            </div>

            <div className="w-full bg-[#1B2320] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[#00E676] h-full rounded-full transition-all duration-500"
                style={{ width: `${globalProgress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <span>{completedLessonsCount} / {totalLessons} Leçons terminées</span>
              {globalProgress === 100 ? (
                <span className="text-[#00E676] font-bold flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Certifié
                </span>
              ) : (
                <span className="text-slate-400">Objectif 100%</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111615]/60 p-4 rounded-xl border border-[#1B2320]">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          {["Tous", "Débutant", "Intermédiaire", "Confirmé"].map((level) => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedLevel === level
                  ? "bg-amber-500 text-slate-950 font-bold shadow"
                  : "text-slate-400 hover:text-white hover:bg-[#1B2320]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>

        {/* Search Field */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un cours ou sujet..."
            className="w-full bg-[#0D1110] border border-[#1B2320] rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {isAdmin && onSaveModule && (
          <button
            onClick={openNewModuleForm}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nouveau module
          </button>
        )}
      </div>

      {/* Modules List */}
      <div className="space-y-6">
        {/* Aucun état vide auparavant : un filtre de niveau ou une recherche
            sans résultat (ou, côté élève, un niveau dont tous les modules
            sont masqués) affichait silencieusement une zone totalement vide,
            indiscernable d'un chargement en cours. Trouvé en audit. */}
        {filteredModules.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Search className="w-8 h-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-400">Aucun module trouvé</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Essaie un autre niveau ou une autre recherche.
            </p>
          </div>
        )}
        {filteredModules.map((module) => {
          const modCompleted = module.lessons.filter((l) => l.isCompleted).length;
          const modTotal = module.lessons.length;
          const modPercent = modTotal > 0 ? Math.round((modCompleted / modTotal) * 100) : 0;
          const isExpanded = expandedModules[module.id] ?? true;

          return (
            <div
              key={module.id}
              className="bg-[#111615] rounded-xl border border-[#1B2320]/90 overflow-hidden transition-all"
            >
              {/* Module Header Bar */}
              <div
                onClick={() => toggleModuleExpand(module.id)}
                className="p-5 bg-[#111615]/90 hover:bg-[#151D1A] cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1B2320]/60 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-[#1B2320]/90 border border-[#232D29]/60 shrink-0">
                    {getModuleIcon(module.iconName)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">
                        {module.category}
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {module.durationTotal}
                      </span>
                      {isAdmin && module.hidden && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1B2320] border border-[#232D29]">
                          <EyeOff className="w-3 h-3" />
                          Masqué
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                      <SectionHeader />
                      {module.title}
                    </h2>
                    <p className="text-xs text-slate-400 line-clamp-2 max-w-3xl">
                      {module.description}
                    </p>
                  </div>
                </div>

                {/* Right Progress Pill, Quiz Module Button & Arrow */}
                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#1B2320]/60">
                  {/* Module Quiz Badge & Launcher */}
                  {module.quiz && module.quiz.length > 0 && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2"
                    >
                      {quizResults[module.id] ? (
                        <button
                          onClick={() => {
                            setActiveModuleQuizModal(module);
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                            quizResults[module.id].passed
                              ? "bg-[#00E676]/15 border-[#00E676]/40 text-[#00E676] hover:bg-[#00E676]/25"
                              : "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                          }`}
                          title="Recommencer le quiz du module"
                        >
                          <GraduationCap className="w-4 h-4" />
                          <span>
                            Quiz: {quizResults[module.id].scorePercentage}% (
                            {quizResults[module.id].passed ? "Réussi" : "À refaire"})
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveModuleQuizModal(module);
                            setQuizAnswers({});
                            setQuizSubmitted(false);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-extrabold transition-all shadow-sm"
                          title="Tester vos connaissances sur ce module"
                        >
                          <GraduationCap className="w-4 h-4 text-purple-400" />
                          <span>Quiz du Module ({module.quiz.length} q.)</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="text-right space-y-1">
                    <div className="text-xs font-semibold text-slate-300">
                      {modCompleted} / {modTotal} leçons ({modPercent}%)
                    </div>
                    <div className="w-28 bg-[#1B2320] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${modPercent}%` }}
                      />
                    </div>
                  </div>

                  {isAdmin && (onSaveModule || onDeleteModule) && (
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
                      {onSaveModule && (
                        <button
                          onClick={() => onSaveModule({ ...module, hidden: !module.hidden })}
                          className="p-2 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white transition-colors"
                          title={module.hidden ? "Rendre le module visible aux élèves" : "Masquer le module aux élèves"}
                        >
                          {module.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {onSaveModule && (
                        <button
                          onClick={() => openEditModuleForm(module)}
                          className="p-2 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white transition-colors"
                          title="Modifier le module"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteModule && (
                        <button
                          onClick={() => handleDeleteModuleClick(module)}
                          className="p-2 rounded-lg bg-[#1B2320] text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                          title="Supprimer le module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  <button className="p-2 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Lesson Items */}
              {isExpanded && (
                <div className="p-4 bg-[#0D1110]/40 divide-y divide-[#1B2320]/50">
                  {module.lessons.map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className="py-3.5 px-3 rounded-xl hover:bg-[#151D1A]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                    >
                      {/* Left Lesson Info & Play */}
                      <div className="flex items-start gap-3.5">
                        <button
                          onClick={() => setActiveLessonModal({ module, lesson })}
                          className="mt-0.5 group shrink-0 p-2 rounded-full bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition-all"
                          title={lesson.videoUrl ? "Lancer le cours vidéo" : "Lire la leçon théorique"}
                        >
                          {lesson.videoUrl ? (
                            <PlayCircle className="w-6 h-6" />
                          ) : (
                            <BookText className="w-6 h-6" />
                          )}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-200">
                              Leçon {idx + 1}: {lesson.title}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded bg-[#1B2320] text-slate-400 font-mono">
                              {lesson.duration}
                            </span>
                            {!lesson.videoUrl && (
                              <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold">
                                Théorie
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{lesson.description}</p>

                          {/* Resource Pills */}
                          {lesson.resources && lesson.resources.length > 0 && (
                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                              {lesson.resources.map((res) => (
                                <a
                                  key={res.id}
                                  href={res.url}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    alert(`Téléchargement de : ${res.title}`);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1B2320] hover:bg-[#232D29] text-slate-300 text-[11px] transition-colors"
                                >
                                  <FileText className="w-3 h-3 text-amber-400" />
                                  <span>{res.title}</span>
                                  <Download className="w-3 h-3 text-slate-400 ml-1" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {/* Quiz Button if exists */}
                        {lesson.quiz && lesson.quiz.length > 0 && (
                          <button
                            onClick={() => {
                              setActiveLessonQuizModal({
                                lessonTitle: lesson.title,
                                quiz: lesson.quiz!,
                              });
                              setQuizAnswers({});
                              setQuizSubmitted(false);
                            }}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-colors"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Quiz ({lesson.quiz.length})</span>
                          </button>
                        )}

                        {/* Ask Coach Question Button */}
                        <button
                          onClick={() => onAskCoachAboutLesson(lesson.title)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-300 text-xs font-medium transition-colors"
                          title="Poser une question au coach sur cette leçon"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden lg:inline">Coach</span>
                        </button>

                        {/* Completion Toggle */}
                        <button
                          onClick={() => onToggleLessonCompletion(module.id, lesson.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lesson.isCompleted
                              ? "bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40"
                              : "bg-[#1B2320] text-slate-400 hover:text-white hover:bg-[#232D29]"
                          }`}
                        >
                          {lesson.isCompleted ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
                              <span>Terminée</span>
                            </>
                          ) : (
                            <>
                              <Circle className="w-4 h-4" />
                              <span>Marquer comme vu</span>
                            </>
                          )}
                        </button>

                        {isAdmin && (onSaveLesson || onDeleteLesson) && (
                          <>
                            {onSaveLesson && (
                              <button
                                onClick={() => openEditLessonForm(module.id, lesson)}
                                className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-white transition-colors"
                                title="Modifier la leçon"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {onDeleteLesson && (
                              <button
                                onClick={() => handleDeleteLessonClick(module.id, lesson)}
                                className="p-1.5 rounded-lg bg-[#1B2320] text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                                title="Supprimer la leçon"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {isAdmin && onSaveLesson && (
                    <button
                      onClick={() => openNewLessonForm(module.id)}
                      className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-[#1B2320] text-slate-400 hover:text-amber-400 hover:border-amber-500/40 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une leçon
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Video Player Modal */}
      {activeLessonModal && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-[#1B2320] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  {activeLessonModal.module.title}
                </span>
                <h3 className="text-lg font-bold text-white">
                  {activeLessonModal.lesson.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveLessonModal(null)}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Video Frame — absent pour une leçon théorique (pas de
                videoUrl) : on saute directement au contenu théorique
                ci-dessous plutôt que d'afficher un lecteur vide. */}
            {activeLessonModal.lesson.videoUrl && (
              <div className="relative bg-black aspect-video w-full flex items-center justify-center border-b border-[#1B2320]">
                <video
                  src={activeLessonModal.lesson.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Video Info & Controls */}
            <div className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-slate-300">
                    {activeLessonModal.lesson.description}
                  </p>
                  <div className="text-xs text-slate-500 font-mono">
                    {activeLessonModal.lesson.videoUrl ? "Durée vidéo" : "Durée"}: {activeLessonModal.lesson.duration}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      onAskCoachAboutLesson(activeLessonModal.lesson.title);
                      setActiveLessonModal(null);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-200 text-xs font-semibold"
                  >
                    <MessageSquare className="w-4 h-4 text-amber-400" />
                    Question au Coach
                  </button>

                  <button
                    onClick={() => {
                      onToggleLessonCompletion(
                        activeLessonModal.module.id,
                        activeLessonModal.lesson.id
                      );
                      setActiveLessonModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              lesson: {
                                ...prev.lesson,
                                isCompleted: !prev.lesson.isCompleted,
                              },
                            }
                          : null
                      );
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeLessonModal.lesson.isCompleted
                        ? "bg-[#00E676] text-slate-950"
                        : "bg-amber-500 text-slate-950 hover:bg-amber-400"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {activeLessonModal.lesson.isCompleted
                      ? "Leçon terminée !"
                      : "Valider cette leçon"}
                  </button>
                </div>
              </div>

              {/* Théorie — n'apparaît que si la leçon en porte une, jamais un
                  bloc vide (voir Lesson.theory, src/types.ts). Paragraphes
                  séparés par une ligne vide dans le texte source. */}
              {activeLessonModal.lesson.theory && (
                <div className="pt-4 border-t border-[#1B2320] space-y-3">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                    <BookText className="w-4 h-4 text-amber-400" />
                    Théorie
                  </h4>
                  <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                    {activeLessonModal.lesson.theory
                      .split(/\n\s*\n/)
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module Quiz Modal */}
      {activeModuleQuizModal && activeModuleQuizModal.quiz && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" /> Quiz du Module
                </span>
                <h3 className="text-lg font-bold text-white">{activeModuleQuizModal.title}</h3>
              </div>
              <button
                onClick={() => setActiveModuleQuizModal(null)}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {activeModuleQuizModal.quiz.map((q, idx) => {
                const selected = quizAnswers[q.id];
                const isCorrect = selected === q.correctAnswerIndex;

                return (
                  <div key={q.id} className="bg-[#0D1110]/60 p-4 rounded-xl border border-[#1B2320] space-y-3">
                    <p className="text-sm font-bold text-slate-200">
                      {idx + 1}. {q.question}
                    </p>

                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        let btnStyle = "bg-[#111615] border-[#1B2320] text-slate-300 hover:border-[#232D29]";
                        if (selected === optIdx) {
                          btnStyle = "bg-purple-600/20 border-purple-500 text-purple-200 font-semibold";
                        }
                        if (quizSubmitted) {
                          if (optIdx === q.correctAnswerIndex) {
                            btnStyle = "bg-[#00E676]/20 border-[#00E676] text-[#00E676] font-bold";
                          } else if (selected === optIdx && !isCorrect) {
                            btnStyle = "bg-rose-500/20 border-rose-500 text-rose-300";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleQuizAnswerSelect(q.id, optIdx)}
                            className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && optIdx === q.correctAnswerIndex && (
                              <Check className="w-4 h-4 text-[#00E676]" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="p-3 rounded-lg bg-[#111615] text-xs text-slate-300 border-l-2 border-amber-400">
                        <span className="font-bold text-amber-400">Explication: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quiz Result Banner if Submitted */}
            {quizSubmitted && (
              <div className="p-4 rounded-xl bg-[#0D1110] border border-[#1B2320] text-center space-y-2">
                {(() => {
                  const correctCount = activeModuleQuizModal.quiz!.filter(
                    (q) => quizAnswers[q.id] === q.correctAnswerIndex
                  ).length;
                  const total = activeModuleQuizModal.quiz!.length;
                  const scorePct = Math.round((correctCount / total) * 100);
                  const isPassed = scorePct >= 70;

                  return (
                    <div>
                      <div className="text-xl font-extrabold text-white">
                        Score final :{" "}
                        <span className={isPassed ? "text-[#00E676]" : "text-amber-400"}>
                          {scorePct}% ({correctCount}/{total} bonnes réponses)
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isPassed
                          ? "Félicitations ! Vous avez validé les compétences théoriques de ce module. Vos résultats sont enregistrés et transmis au coach."
                          : "Vous n'avez pas atteint le seuil de 70%. Relisez les leçons et tentez à nouveau le quiz pour valider le module."}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Quiz Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1B2320]">
              {quizSubmitted ? (
                <div className="flex items-center gap-3 w-full justify-between">
                  <button
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizSubmitted(false);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-medium"
                  >
                    <RotateCcw className="w-4 h-4" /> Recommencer le Quiz
                  </button>

                  <button
                    onClick={() => setActiveModuleQuizModal(null)}
                    className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00E676] text-slate-950 font-bold text-xs shadow-lg shadow-[#00E676]/20"
                  >
                    Terminer & Enregistrer
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-xs text-slate-400">
                    {Object.keys(quizAnswers).length} / {activeModuleQuizModal.quiz.length} réponses renseignées
                  </div>

                  <button
                    onClick={() => {
                      if (!activeModuleQuizModal.quiz) return;
                      setQuizSubmitted(true);
                      const correctCount = activeModuleQuizModal.quiz.filter(
                        (q) => quizAnswers[q.id] === q.correctAnswerIndex
                      ).length;
                      const total = activeModuleQuizModal.quiz.length;
                      const scorePct = Math.round((correctCount / total) * 100);
                      const isPassed = scorePct >= 70;
                      onSaveModuleQuizResult(activeModuleQuizModal.id, {
                        scorePercentage: scorePct,
                        totalQuestions: total,
                        correctAnswers: correctCount,
                        passed: isPassed,
                        completedAt: new Date().toLocaleDateString("fr-FR"),
                      });
                    }}
                    disabled={Object.keys(quizAnswers).length === 0}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20"
                  >
                    Valider mes réponses
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lesson Quiz Modal */}
      {activeLessonQuizModal && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1B2320] pb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Quiz Rapide de Leçon
                </span>
                <h3 className="text-lg font-bold text-white">{activeLessonQuizModal.lessonTitle}</h3>
              </div>
              <button
                onClick={() => setActiveLessonQuizModal(null)}
                className="p-2 rounded-lg bg-[#1B2320] hover:bg-[#232D29] text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {activeLessonQuizModal.quiz.map((q, idx) => {
                const selected = quizAnswers[q.id];
                const isCorrect = selected === q.correctAnswerIndex;

                return (
                  <div key={q.id} className="bg-[#0D1110]/60 p-4 rounded-xl border border-[#1B2320] space-y-3">
                    <p className="text-sm font-bold text-slate-200">
                      {idx + 1}. {q.question}
                    </p>

                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        let btnStyle = "bg-[#111615] border-[#1B2320] text-slate-300 hover:border-[#232D29]";
                        if (selected === optIdx) {
                          btnStyle = "bg-purple-600/20 border-purple-500 text-purple-200 font-semibold";
                        }
                        if (quizSubmitted) {
                          if (optIdx === q.correctAnswerIndex) {
                            btnStyle = "bg-[#00E676]/20 border-[#00E676] text-[#00E676] font-bold";
                          } else if (selected === optIdx && !isCorrect) {
                            btnStyle = "bg-rose-500/20 border-rose-500 text-rose-300";
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleQuizAnswerSelect(q.id, optIdx)}
                            className={`w-full text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && optIdx === q.correctAnswerIndex && (
                              <Check className="w-4 h-4 text-[#00E676]" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="p-3 rounded-lg bg-[#111615] text-xs text-slate-300 border-l-2 border-purple-400">
                        <span className="font-bold text-purple-400">Explication: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#1B2320]">
              {quizSubmitted ? (
                <button
                  onClick={() => {
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B2320] text-slate-300 text-xs font-medium"
                >
                  <RotateCcw className="w-4 h-4" /> Recommencer
                </button>
              ) : (
                <div className="text-xs text-slate-400">
                  {Object.keys(quizAnswers).length} / {activeLessonQuizModal.quiz.length} réponses
                </div>
              )}

              {!quizSubmitted && (
                <button
                  onClick={() => setQuizSubmitted(true)}
                  disabled={Object.keys(quizAnswers).length === 0}
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-purple-500/20"
                >
                  Valider mes réponses
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Module Edit/Create Modal */}
      {moduleEditTarget && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitModuleForm}
            className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {moduleEditTarget === "new" ? "Nouveau module" : "Modifier le module"}
              </h3>
              <button
                type="button"
                onClick={() => setModuleEditTarget(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Titre</label>
              <input
                type="text"
                required
                autoFocus
                value={moduleForm.title}
                onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Niveau</label>
                <select
                  value={moduleForm.category}
                  onChange={(e) => setModuleForm((f) => ({ ...f, category: e.target.value as CourseLevel }))}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  {COURSE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Icône</label>
                <select
                  value={moduleForm.iconName}
                  onChange={(e) => setModuleForm((f) => ({ ...f, iconName: e.target.value }))}
                  className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  {MODULE_ICON_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Durée totale (ex: "2h30")</label>
              <input
                type="text"
                value={moduleForm.durationTotal}
                onChange={(e) => setModuleForm((f) => ({ ...f, durationTotal: e.target.value }))}
                placeholder="2h30"
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
              <textarea
                rows={3}
                value={moduleForm.description}
                onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModuleEditTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lesson Edit/Create Modal */}
      {lessonEditTarget && (
        <div className="fixed inset-0 z-50 bg-[#0D1110]/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitLessonForm}
            className="bg-[#111615] border border-[#1B2320] rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {lessonEditTarget.lessonId === "new" ? "Nouvelle leçon" : "Modifier la leçon"}
              </h3>
              <button
                type="button"
                onClick={() => setLessonEditTarget(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-[#1B2320]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Titre</label>
              <input
                type="text"
                required
                autoFocus
                value={lessonForm.title}
                onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="max-w-[calc(50%-0.375rem)]">
              <label className="block text-xs font-medium text-slate-300 mb-1">Durée (ex: "18 min")</label>
              <input
                type="text"
                value={lessonForm.duration}
                onChange={(e) => setLessonForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="18 min"
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            {/* Vidéo optionnelle — laisser vide pour une leçon 100%
                théorique (voir Lesson.theory, src/types.ts). Sinon, deux
                façons d'y arriver : coller un lien existant (YouTube, Vimeo,
                autre hébergeur) ou téléverser directement un fichier, hébergé
                sur ce serveur (server/uploads.ts) et publié sous une URL
                propre à l'écosystème, réinjectée automatiquement ci-dessous
                une fois l'envoi terminé. */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Vidéo (optionnel) — lien externe ou fichier téléversé
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={lessonForm.videoUrl}
                  onChange={(e) => setLessonForm((f) => ({ ...f, videoUrl: e.target.value }))}
                  placeholder="https://... (ou téléverse un fichier →)"
                  className="flex-1 bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg,.mp4,.webm,.mov,.mkv,.ogv"
                  onChange={handleVideoFileSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  disabled={videoUploadPercent !== null}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] disabled:opacity-60 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <Upload className="w-4 h-4 text-amber-400" />
                  {videoUploadPercent !== null ? `${videoUploadPercent}%` : "Téléverser"}
                </button>
              </div>
              {videoUploadPercent !== null && (
                <div className="w-full h-1.5 rounded-full bg-[#1B2320] overflow-hidden mt-2">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${videoUploadPercent}%` }}
                  />
                </div>
              )}
              {videoUploadError && (
                <p className="text-[11px] text-rose-400 mt-1.5">{videoUploadError}</p>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5">
                Formats acceptés en téléversement : mp4, webm, mov, mkv, ogv — jusqu'à 2 Go.
                Laisse ce champ vide pour publier une leçon théorique sans vidéo.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Description courte</label>
              <textarea
                rows={2}
                value={lessonForm.description}
                onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1">
                <BookText className="w-3.5 h-3.5 text-amber-400" />
                Théorie (optionnel — un paragraphe par ligne vide)
              </label>
              <textarea
                rows={8}
                value={lessonForm.theory}
                onChange={(e) => setLessonForm((f) => ({ ...f, theory: e.target.value }))}
                placeholder="Rédige ici le contenu théorique de la leçon, affiché sous la vidéo..."
                className="w-full bg-[#0D1110] border border-[#1B2320] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/50 resize-y font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLessonEditTarget(null)}
                className="px-4 py-2.5 rounded-xl bg-[#1B2320] hover:bg-[#232D29] text-slate-300 font-bold text-xs"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
