import { generateAsciiExercises } from "@/features/ascii-converter";
import { generateIpv4Exercises } from "@/features/ipv4-calculator";
import { generateNumberBaseExercises } from "@/features/number-base-converter";
import type { TFunction } from "i18next";

import type { ExerciseBlock } from "@/lib/exercises/sets";
import type { ExerciseGenerator } from "@/lib/exercises/utils";
import { buildExerciseSetPdf, pdfFilename } from "@/lib/pdf/exercisePdf";

/**
 * Every tool that can produce exercises, keyed by a stable id that saved
 * exercise sets store. Lives in `config/` — like `TabHost`, it is the one
 * place allowed to gather several features, so the teacher panel can combine
 * them without a feature importing another.
 *
 * A new tool with a generator joins `Crear ejercicios` by adding one entry.
 * Never rename an id: stored sets reference it.
 */
export type ExerciseTool = {
  id: string;
  /** i18n key of the tool's display name. */
  titleKey: string;
  generator: ExerciseGenerator;
};

export const EXERCISE_TOOLS: readonly ExerciseTool[] = [
  {
    id: "number-bases",
    titleKey: "tools.numberBaseConverter.title",
    generator: generateNumberBaseExercises,
  },
  {
    id: "ascii",
    titleKey: "tools.asciiConverter.title",
    generator: generateAsciiExercises,
  },
  {
    id: "ipv4",
    titleKey: "tools.ipv4Calculator.title",
    generator: generateIpv4Exercises,
  },
];

export function findExerciseTool(id: string): ExerciseTool | undefined {
  return EXERCISE_TOOLS.find((tool) => tool.id === id);
}

/**
 * Renders a frozen exercise set as the institutional PDF. Shared by `Mis
 * ejercicios` (download) and `Asignar` (attach), which is why it sits next to
 * the registry that names each block's tool.
 */
export async function renderExerciseSetPdf(
  set: { title: string; blocks: readonly ExerciseBlock[] },
  includeAnswers: boolean,
  t: TFunction,
): Promise<File> {
  const blob = await buildExerciseSetPdf({
    title: set.title,
    sections: set.blocks.map((block) => {
      const tool = findExerciseTool(block.toolId);
      return {
        toolTitle: tool ? t(tool.titleKey) : block.toolId,
        difficulty: block.difficulty,
        exercises: block.exercises,
      };
    }),
    includeAnswers,
    t,
  });
  const name = pdfFilename(set.title, includeAnswers ? t("teacher.pdf.withAnswersSuffix") : undefined);
  return new File([blob], name, { type: "application/pdf" });
}
