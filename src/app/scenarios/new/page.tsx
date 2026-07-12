import { ScenarioForm } from "@/components/scenarios/ScenarioForm";

export default function NewScenarioPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">シナリオを作成</h1>
      <ScenarioForm />
    </div>
  );
}
