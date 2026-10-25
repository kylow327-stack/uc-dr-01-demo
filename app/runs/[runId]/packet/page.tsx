import { PacketView } from "@/components/PacketView";

export default async function PacketPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <PacketView runId={runId} />;
}
