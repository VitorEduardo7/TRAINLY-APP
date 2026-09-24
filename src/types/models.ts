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
}

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
  profile?: Pick<Profile, 'id' | 'name' | 'avatar_url'>;
}

export interface ClubChallenge {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  goal_km: number;
  start_date: string; // AAAA-MM-DD
  end_date: string; // AAAA-MM-DD
  created_by: string;
  created_at: string;
}

export interface ChallengeProgress {
  userId: string;
  name: string;
  km: number;
  goalKm: number;
  pct: number; // 0-100+
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
}

// --- Amigos (seguir + feed + curtidas) -------------------------------------

export interface SearchProfile {
  id: string;
  name: string;
  avatar_url: string | null;
  isFollowing: boolean;
}

export interface FeedActivity {
  id: string;
  user_id: string;
  authorName: string;
  authorAvatarUrl: string | null;
  date: string;
  type: ActivityType;
  title: string | null;
  distance_km: number;
  duration_sec: number;
  elevation_m: number | null;
  xp_earned: number;
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

export interface ActivityComment {
  id: string;
  activityId: string;
  userId: string;
  replyToId: string | null;
  body: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
}

// --- Conquistas -------------------------------------------------------

export type AchievementCategory = 'milestone' | 'time_of_day' | 'social';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  xp_reward: number;
  params: Record<string, number>;
  sort_order: number;
}
