export type ActivityType = 'Corrida' | 'Ciclismo' | 'Natação' | 'Caminhada';

export interface Profile {
  id: string;
  name: string;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  xp: number;
  monthly_goal_km: number;
  created_at: string;
  /** Moldura de avatar preferida (Bronze..Diamante) — `null` = automático (usa a patente atual). */
  equipped_frame_tier: string | null;
  /** Cor do mapa preferida na sua própria corrida — `null` = automático (usa a patente atual). */
  equipped_map_tier: string | null;
  /** Foto de capa do perfil (bucket `covers`) — vem do site, ver site_integration.sql. */
  cover_url?: string | null;
  /** Tipo da meta do mês (igual ao site): km, número de atividades ou horas. */
  monthly_goal_type?: GoalType | null;
  /** Valor da meta do mês, na unidade de `monthly_goal_type`. */
  monthly_goal_value?: number | null;
  /** Último dia (AAAA-MM-DD, horário de Brasília) em que resgatou a recompensa diária. */
  last_daily_reward?: string | null;
}

export type GoalType = 'km' | 'activities' | 'hours';

export interface Activity {
  id: string;
  user_id: string;
  date: string; // ISO
  type: ActivityType;
  title: string | null;
  distance_km: number;
  duration_sec: number;
  heart_rate: number | null;
  elevation_m: number | null;
  xp_earned: number;
  path: [number, number][] | null; // [lat, lon][]
  created_at: string;
  /** Foto do treino (bucket `activity-photos`), opcional. */
  photo_url?: string | null;
}

export interface PersonalRecord {
  type: ActivityType;
  label: string; // ex: "Melhor 5km", "Maior distância"
  value: string;
  date: string;
}

// --- Clubes e desafios --------------------------------------------------

export interface Club {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
  created_at: string;
}

export type ClubRole = 'admin' | 'member';

export interface ClubMember {
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  /** Silenciado pelo admin — não some do clube, mas fica de fora dos
   *  rankings (desafios e Guerra de Clã) enquanto durar. */
  silenced: boolean;
  profile?: Pick<Profile, 'id' | 'name' | 'avatar_url'>;
}

/** Como o desafio é medido (igual ao site): km, atividades, horas ou dias ativos. */
export type ChallengeMetric = 'km' | 'activities' | 'hours' | 'days';

export interface ClubChallenge {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  /** Meta por membro — só faz sentido (e só aparece) em desafio de km com valor > 0. */
  goal_km: number;
  /** Ausente em bancos que ainda não rodaram site_integration.sql → trata como 'km'. */
  metric?: ChallengeMetric | null;
  start_date: string; // AAAA-MM-DD
  end_date: string; // AAAA-MM-DD
  created_by: string;
  created_at: string;
}

export interface ChallengeProgress {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  /** Valor na métrica do desafio (km, atividades, horas ou dias). */
  value: number;
  /** Mantido por compatibilidade: igual a `value` quando a métrica é km. */
  km: number;
  goalKm: number;
  pct: number; // 0-100+ (só com meta de km)
}

// --- Rotas ----------------------------------------------------------------

export type RouteType = 'Corrida' | 'Ciclismo' | 'Caminhada';
export type RouteDifficulty = 'Fácil' | 'Moderada' | 'Difícil';

export interface TrainlyRoute {
  id: string;
  created_by: string;
  source_activity_id: string | null;
  name: string;
  type: RouteType;
  difficulty: RouteDifficulty;
  terrain: string | null;
  distance_km: number;
  elevation_m: number | null;
  path: [number, number][];
  created_at: string;
  creator_name?: string;
  /** XP de quem publicou — junto com `creator_map_tier`, decide a cor do traçado (ver `effectiveTier`). */
  creator_xp?: number;
  creator_map_tier?: string | null;
}

// --- Amigos (seguir) -----------------------------------------------------------

export interface SearchProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  isFollowing: boolean;
}

// --- Publicações (posts) — as mesmas do site -------------------------------

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

export interface Post {
  id: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  content: string | null;
  photoUrl: string | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  /** Só amigos (alguém que eu sigo ou que me segue) podem curtir e comentar — regra do banco. */
  canInteract: boolean;
  isMine: boolean;
  comments: PostComment[];
}

// --- Conquistas -------------------------------------------------------

export type AchievementCategory =
  | 'milestone'
  | 'distance'
  | 'single'
  | 'speed'
  | 'sports'
  | 'time_of_day'
  | 'consistency'
  | 'social'
  | 'clubs'
  | 'quests'
  | 'secret';

/** Nível da conquista (conquistas.sql). */
export type AchievementTier = 'bronze' | 'prata' | 'ouro' | 'lendaria';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xp_reward: number;
  /** Regra: {"stat": "total_km", "gte": 100} ou {"stat": "best_pace_5k", "lte": 5}... */
  params: Record<string, unknown>;
  sort_order: number;
  /** Só existem depois do conquistas.sql — antes disso valem bronze / não secreta. */
  tier?: AchievementTier;
  secret?: boolean;
}

// --- Desafios (diários/semanais) ---------------------------------------

export type QuestPeriod = 'daily' | 'weekly';
export type QuestGoalType = 'distance_km' | 'activity_count' | 'duration_min';

/** Uma linha de `get_current_quests` — já junta o catálogo com o progresso da pessoa. */
export interface CurrentQuest {
  user_quest_id: string;
  quest_id: string;
  title: string;
  description: string;
  icon: string;
  period: QuestPeriod;
  goal_type: QuestGoalType;
  goal_value: number;
  xp_reward: number;
  progress: number;
  completed: boolean;
  completed_at: string | null;
}

// --- Guerra de Clã --------------------------------------------------------

/** Uma linha de `get_clan_war_leaderboard` — um clube e o XP (com teto
 *  diário por atleta) que ele somou na guerra do fim de semana atual. */
export interface ClanWarClub {
  club_id: string;
  club_name: string;
  war_xp: number;
  member_count: number;
}

/** Uma linha de `get_clan_war_members` — quanto XP um membro específico
 *  rendeu pro clube na guerra atual. */
export interface ClanWarMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  war_xp: number;
  /** Silenciado pelo admin — `war_xp` já vem zerado pelo banco quando true. */
  silenced: boolean;
}
