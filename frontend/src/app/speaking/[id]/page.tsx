import SpeakingDetail from "./SpeakingDetail";

export default async function SpeakingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SpeakingDetail id={Number(id)} />;
}
