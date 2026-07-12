import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { skillsSchema } from "@/lib/coc6/types";
import {
  CharacterForm,
  type CharacterFormValues,
} from "@/components/characters/CharacterForm";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const character = await prisma.character.findUnique({ where: { id } });
  if (!character) notFound();

  const initial: CharacterFormValues = {
    name: character.name,
    playerName: character.playerName ?? "",
    occupation: character.occupation ?? "",
    age: character.age?.toString() ?? "",
    sex: character.sex ?? "",
    imageUrl: character.imageUrl ?? "",
    stats: {
      str: character.str,
      con: character.con,
      pow: character.pow,
      dex: character.dex,
      app: character.app,
      siz: character.siz,
      int_: character.int_,
      edu: character.edu,
    },
    skills: skillsSchema.catch({}).parse(JSON.parse(character.skillsJson)),
    memo: character.memo ?? "",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{character.name} を編集</h1>
      <CharacterForm initial={initial} characterId={character.id} />
    </div>
  );
}
