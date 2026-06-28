import ReadingDetail from "./ReadingDetail";

export default async function ReadingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReadingDetail id={Number(id)} />;
}
