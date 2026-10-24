export function Spinner({ small }: { small?: boolean }) {
  return <span className={small ? 'spinner spinner--sm' : 'spinner'} aria-hidden="true" />;
}

export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-mark">
        <img src="/imgs/dasman-logo.png" alt="" width="64" height="35" />
      </span>
      <Spinner />
    </div>
  );
}
