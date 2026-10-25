import { HitlView } from "@/components/HitlView";

export default async function HitlPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <HitlView runId={runId} />;
}
