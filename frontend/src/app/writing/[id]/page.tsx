import WritingDetail from "./WritingDetail";

export default async function WritingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WritingDetail id={Number(id)} />;
}
