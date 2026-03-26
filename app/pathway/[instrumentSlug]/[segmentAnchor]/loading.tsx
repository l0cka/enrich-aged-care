import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="pathway-page">
      <PageLoading
        title="Loading pathway"
        description="Preparing connected provisions across instruments."
      />
    </div>
  );
}
