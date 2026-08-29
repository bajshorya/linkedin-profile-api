import type { Entity, EntityIndex } from '../normalize.js';
import { formatLiDate, durationMonths, type LiDate } from '../../utils/dates.js';
import { parseLogoUrl } from './images.js';
import { str } from '../../utils/str.js';

export interface ParsedExperience {
  title: string | null;
  company: string | null;
  companyUrl: string | null;
  companyLogo: string | null;
  employmentType: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  durationMonths: number | null;
  description: string | null;
}

interface DateRange {
  start?: LiDate | null;
  end?: LiDate | null;
}

/**
 * Parse experience from the flat pool of Position entities. Voyager also returns
 * PositionGroup entities (the UI groups consecutive roles at one employer); we keep
 * a flat, most-recent-first list, which is what most consumers want.
 */
export function parseExperience(index: EntityIndex): ParsedExperience[] {
  const positions = index.byType('identity.profile.Position');

  const parsed = positions.map((pos) => {
    const range = (pos.dateRange ?? {}) as DateRange;
    const company = index.resolveOne(pos['*company'] as string | undefined);
    const isCurrent = !range.end || typeof range.end.year !== 'number';

    return {
      title: str(pos.title),
      company: str(pos.companyName) ?? str(company?.name),
      companyUrl: str(company?.url),
      companyLogo: parseLogoUrl(company),
      employmentType: str(pos.employmentType) ?? str(pos.employmentTypeUrn),
      location: str(pos.locationName) ?? str(pos.geoLocationName),
      startDate: formatLiDate(range.start),
      endDate: formatLiDate(range.end),
      isCurrent,
      durationMonths: durationMonths(range.start, range.end),
      description: str(pos.description),
      _sortKey: sortKey(range.start),
    };
  });

  parsed.sort((a, b) => b._sortKey - a._sortKey);
  return parsed.map(({ _sortKey, ...rest }) => rest);
}

function sortKey(start: LiDate | null | undefined): number {
  if (!start || typeof start.year !== 'number') return -1;
  return start.year * 12 + ((start.month ?? 1) - 1);
}
