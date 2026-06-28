import GrammarDetail from "./GrammarDetail";

export default async function GrammarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GrammarDetail id={Number(id)} />;
}
