import { Module, Trade, CoachMessage, StudentProfile, ForumTopic, TradingAccount, CoachSignal, TraderBadge, EnrolledStudent, AppNotification } from "../types";

export const initialStudentProfile: StudentProfile = {
  name: "",
  email: "",
  avatar: "",
  level: "",
  joinedDate: "",
  startingCapital: 0,
  currentCapital: 0,
};

export const initialModules: Module[] = [];

export const initialTrades: Trade[] = [];

export const initialMessages: CoachMessage[] = [];

export const initialForumTopics: ForumTopic[] = [];

export const initialTradingAccounts: TradingAccount[] = [];

export const initialCoachSignals: CoachSignal[] = [];

export const initialTraderBadges: TraderBadge[] = [];

export const initialEnrolledStudents: EnrolledStudent[] = [];

export const initialNotifications: AppNotification[] = [];
