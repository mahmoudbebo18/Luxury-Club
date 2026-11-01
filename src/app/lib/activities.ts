// Activities: shared types and labels for the member page, the admin pages and check-in.
export const CATEGORIES = ['sport', 'entertainment', 'workshop', 'trip', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export type ActivityState = 'draft' | 'open' | 'full' | 'closed' | 'ended' | 'cancelled';

export const CATEGORY_ICON: Record<Category, string> = {
  sport: 'trophy',
  entertainment: 'sparkle',
  workshop: 'flask',
  trip: 'car',
  other: 'calendar',
};

export const CATEGORY_AR: Record<Category, string> = {
  sport: 'رياضي',
  entertainment: 'ترفيهي',
  workshop: 'ورشة عمل',
  trip: 'رحلة',
  other: 'أخرى',
};

export const STATE_AR: Record<ActivityState, string> = {
  draft: 'مسودة',
  open: 'التسجيل مفتوح',
  full: 'مكتمل العدد',
  closed: 'التسجيل مغلق',
  ended: 'انتهى',
  cancelled: 'ملغي',
};

export const STATE_TONE = {
  draft: 'neutral',
  open: 'active',
  full: 'gold',
  closed: 'expired',
  ended: 'neutral',
  cancelled: 'suspended',
} as const;

export type TeamMate = { member_no: string; name: string; is_captain: boolean };

/** One activity as returned by list_activities() for the signed-in member. */
export type MemberActivity = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  category: Category;
  location: string;
  starts_at: string;
  ends_at: string | null;
  registration_closes_at: string | null;
  mode: 'individual' | 'team';
  capacity: number;
  team_min: number | null;
  team_max: number | null;
  taken: number;
  state: ActivityState;
  registration_id: string | null;
  is_captain: boolean | null;
  team_name: string | null;
  captain_name: string | null;
  checked_in_at: string | null;
  team: TeamMate[] | null;
};

/** Result of the member-side RPCs (register, update team, leave, check-in). */
export type RpcResult = { ok: true; [k: string]: unknown } | { ok: false; error: string; members?: string[]; min?: number; max?: number; member_no?: string };

/** "DSM-0012", "0012" and "12" all mean member 12. */
export const normalizeMemberNo = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return digits ? 'DSM-' + digits.replace(/^0+(?=\d)/, '').padStart(4, '0') : '';
};
