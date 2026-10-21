import type { MembershipStatus } from '../lib/format';

const AR: Record<MembershipStatus, string> = { active: 'سارية', expired: 'منتهية', suspended: 'موقوفة' };

export function StatusBadge({ status, label }: { status: MembershipStatus; label?: string }) {
  return <span className={`badge badge--${status}`}>{label ?? AR[status]}</span>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'active' | 'expired' | 'suspended' | 'gold'; children: React.ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
