import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="search-page">
      <PageLoading
        title="Loading search"
        description="Preparing filters and search results."
      />
    </div>
  );
}
