import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="maps-page">
      <PageLoading
        title="Loading maps"
        description="Preparing decision pathway maps."
      />
    </div>
  );
}
