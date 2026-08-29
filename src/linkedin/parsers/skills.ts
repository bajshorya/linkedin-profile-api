import type { EntityIndex } from '../normalize.js';
import { str } from '../../utils/str.js';

export interface ParsedSkill {
  name: string | null;
  endorsementCount: number | null;
}

/**
 * Skills come from the ProfileCards / profileSkills section entities
 * (`identity.profile.Skill`). Endorsement count location varies by decoration, so
 * we probe the few known fields defensively.
 */
export function parseSkills(index: EntityIndex): ParsedSkill[] {
  return index.byType('identity.profile.Skill').map((skill) => {
    const insights = skill.insights as unknown;
    let endorsementCount: number | null =
      typeof skill.endorsementCount === 'number' ? skill.endorsementCount : null;
    if (endorsementCount === null && Array.isArray(insights)) {
      for (const ins of insights) {
        const c = (ins as Record<string, unknown>)?.endorsedSkillInsightCount;
        if (typeof c === 'number') endorsementCount = c;
      }
    }
    return { name: str(skill.name), endorsementCount };
  });
}
