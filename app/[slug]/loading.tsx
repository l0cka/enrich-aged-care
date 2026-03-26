import { PageLoading } from "@/components/page-loading";

export default function Loading() {
  return (
    <div className="reader-page">
      <PageLoading
        title="Loading reader"
        description="Preparing sections, links, and related provisions."
      />
    </div>
  );
}
