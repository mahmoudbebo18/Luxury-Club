import { Icon } from './Icon';

export function EmptyState({ icon = 'ticket', children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} /></span>
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="empty-state empty-state--error" role="alert">
      <span className="empty-icon"><Icon name="alert" /></span>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          <Icon name="refresh" />
          {retryLabel ?? 'إعادة المحاولة'}
        </button>
      )}
    </div>
  );
}
