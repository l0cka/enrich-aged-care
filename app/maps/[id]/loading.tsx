import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="map-detail-page">
      <PageLoading
        title="Loading map"
        description="Preparing grouped provisions for this decision pathway."
      />
    </div>
  );
}
