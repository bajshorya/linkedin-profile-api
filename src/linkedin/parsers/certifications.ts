import type { EntityIndex } from '../normalize.js';
import { formatLiDate, type LiDate } from '../../utils/dates.js';
import { str } from '../../utils/str.js';

export interface ParsedCertification {
  name: string | null;
  authority: string | null;
  licenseNumber: string | null;
  url: string | null;
  issuedDate: string | null;
  expirationDate: string | null;
}

interface DateRange {
  start?: LiDate | null;
  end?: LiDate | null;
}

export function parseCertifications(index: EntityIndex): ParsedCertification[] {
  return index.byType('identity.profile.Certification').map((cert) => {
    const range = (cert.dateRange ?? {}) as DateRange;
    return {
      name: str(cert.name),
      authority: str(cert.authority),
      licenseNumber: str(cert.licenseNumber),
      url: str(cert.url),
      issuedDate: formatLiDate(range.start),
      expirationDate: formatLiDate(range.end),
    };
  });
}
