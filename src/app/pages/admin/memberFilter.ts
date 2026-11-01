// Member search/filter shared by the members list, coupon distribution and email campaigns.
import { supabase } from '../../../lib/supabase';
import type { Tables } from '../../types/database';

export type AdminMember = Tables<'admin_members'>;

export type MemberFilter = {
  q?: string;
  university?: string;
  year?: string;
  status?: '' | 'active' | 'expired' | 'suspended';
  group?: '' | 'ambassadors' | 'referred';
};

export const STATUS_LABELS = { active: 'سارية', expired: 'منتهية', suspended: 'موقوفة' } as const;
export const GROUP_LABELS = { ambassadors: 'السفراء', referred: 'سجّلوا عن طريق سفير' } as const;

export function describeFilter(f: MemberFilter) {
  const parts = [
    f.status && `الحالة: ${STATUS_LABELS[f.status]}`,
    f.group && GROUP_LABELS[f.group],
    f.university && `الجامعة: ${f.university}`,
    f.year && `السنة: ${f.year}`,
    f.q && `بحث: ${f.q}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'كل الأعضاء';
}

export function memberQuery<T extends string>(columns: T, f: MemberFilter, count?: 'exact') {
  let q = supabase.from('admin_members').select(columns, count ? { count } : undefined).eq('role', 'member');
  if (f.status) q = q.eq('status', f.status);
  if (f.university) q = q.eq('university', f.university);
  if (f.year) q = q.eq('study_year', f.year);
  if (f.group === 'ambassadors') q = q.eq('is_ambassador', true);
  if (f.group === 'referred') q = q.not('referred_by', 'is', null);
  const term = f.q?.trim().replace(/[%,()]/g, ' ');
  if (term) {
    q = q.or(
      ['full_name', 'email', 'phone', 'member_label', 'member_code'].map((c) => `${c}.ilike.%${term}%`).join(','),
    );
  }
  return q;
}

/** All member ids matching a filter (paged past PostgREST's 1000-row limit). */
export async function memberIdsFor(f: MemberFilter) {
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await memberQuery('id', f).order('member_no').range(from, from + 999);
    if (error) throw error;
    ids.push(...(data as unknown as { id: string }[]).map((r) => r.id));
    if (!data || data.length < 1000) return ids;
  }
}

export async function universities() {
  const { data, error } = await supabase.from('profiles').select('university').eq('role', 'member');
  if (error) throw error;
  return [...new Set(data.map((r) => r.university).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar'));
}

/** Readable error for admin RPC failures raised by the database functions. */
export function adminError(err: unknown) {
  const e = err as { message?: string; details?: string } | null;
  switch (e?.message) {
    case 'not_enough_coupons':
      return `الكوبونات المتبقية في الدفعة (${e.details ?? 0}) أقل من عدد الأعضاء المختارين.`;
    case 'batch_expired':
      return 'هذه الدفعة منتهية الصلاحية.';
    case 'pin_format':
      return 'الرقم السري يجب أن يكون من 4 إلى 8 أرقام.';
    case 'not_voidable':
      return 'هذه العملية ملغاة مسبقًا.';
    case 'capacity_below_taken':
      return `العدد لا يمكن أن يكون أقل من المسجلين حاليًا (${e.details ?? 0}).`;
    case 'mode_locked':
      return 'لا يمكن تغيير نوع التسجيل (فردي/فرق) بعد وجود مسجلين.';
    case 'has_registrations':
      return 'لا يمكن حذف نشاط فيه مسجلون، ألغِ النشاط بدلًا من ذلك.';
    case 'not_found':
      return 'العنصر غير موجود أو تم تحديثه، أعد تحميل الصفحة.';
    case 'forbidden':
      return 'ليست لديك صلاحية لهذا الإجراء.';
    default:
      return 'حدث خطأ، الرجاء المحاولة مرة أخرى.';
  }
}
