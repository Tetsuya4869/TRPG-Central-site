import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ScenarioForm,
  type ScenarioFormValues,
} from "@/components/scenarios/ScenarioForm";

export const dynamic = "force-dynamic";

export default async function EditScenarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scenario = await prisma.scenario.findUnique({ where: { id } });
  if (!scenario) notFound();

  const initial: ScenarioFormValues = {
    title: scenario.title,
    content: scenario.content,
    summary: scenario.summary ?? "",
    tags: scenario.tags ?? "",
    source: scenario.source,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{scenario.title} を編集</h1>
      <ScenarioForm initial={initial} scenarioId={scenario.id} />
    </div>
  );
}
