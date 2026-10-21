export function Spinner({ small }: { small?: boolean }) {
  return <span className={small ? 'spinner spinner--sm' : 'spinner'} aria-hidden="true" />;
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <Spinner />
    </div>
  );
}
