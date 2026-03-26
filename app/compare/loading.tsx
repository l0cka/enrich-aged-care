import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="compare-page">
      <PageLoading
        title="Loading comparison"
        description="Preparing linked Act and Rules provisions."
      />
    </div>
  );
}
