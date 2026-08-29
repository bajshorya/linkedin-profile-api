import type { EntityIndex } from '../normalize.js';
import { type LiDate } from '../../utils/dates.js';
import { parseLogoUrl } from './images.js';
import { str } from '../../utils/str.js';

export interface ParsedEducation {
  school: string | null;
  schoolUrl: string | null;
  schoolLogo: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
  grade: string | null;
  description: string | null;
}

interface DateRange {
  start?: LiDate | null;
  end?: LiDate | null;
}

export function parseEducation(index: EntityIndex): ParsedEducation[] {
  const educations = index.byType('identity.profile.Education');

  const parsed = educations.map((edu) => {
    const range = (edu.dateRange ?? {}) as DateRange;
    const school = index.resolveOne(edu['*school'] as string | undefined);
    return {
      school: str(edu.schoolName) ?? str(school?.name),
      schoolUrl: str(school?.url),
      schoolLogo: parseLogoUrl(school),
      degree: str(edu.degreeName),
      fieldOfStudy: str(edu.fieldOfStudy),
      startYear: typeof range.start?.year === 'number' ? range.start.year : null,
      endYear: typeof range.end?.year === 'number' ? range.end.year : null,
      grade: str(edu.grade),
      description: str(edu.description),
    };
  });

  parsed.sort((a, b) => (b.endYear ?? b.startYear ?? 0) - (a.endYear ?? a.startYear ?? 0));
  return parsed;
}
