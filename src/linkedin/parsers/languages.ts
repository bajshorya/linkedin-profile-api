import type { EntityIndex } from '../normalize.js';
import { str } from '../../utils/str.js';

export interface ParsedLanguage {
  name: string | null;
  proficiency: string | null;
}

// LinkedIn returns proficiency as an enum token; map to human-readable labels.
const PROFICIENCY_LABELS: Record<string, string> = {
  NATIVE_OR_BILINGUAL: 'Native or bilingual proficiency',
  FULL_PROFESSIONAL: 'Full professional proficiency',
  PROFESSIONAL_WORKING: 'Professional working proficiency',
  LIMITED_WORKING: 'Limited working proficiency',
  ELEMENTARY: 'Elementary proficiency',
};

export function parseLanguages(index: EntityIndex): ParsedLanguage[] {
  return index.byType('identity.profile.Language').map((lang) => {
    const token = str(lang.proficiency);
    return {
      name: str(lang.name),
      proficiency: token ? (PROFICIENCY_LABELS[token] ?? token) : null,
    };
  });
}
