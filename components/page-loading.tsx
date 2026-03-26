type PageLoadingProps = {
  title: string;
  description: string;
};

export function PageLoading({ title, description }: PageLoadingProps) {
  return (
    <div className="empty-state" aria-live="polite" role="status">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
