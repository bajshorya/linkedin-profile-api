/**
 * LinkedIn images are `VectorImage` objects:
 *   { rootUrl, artifacts: [{ width, height, fileIdentifyingUrlPathSegment, expiresAt }] }
 * The final URL is `rootUrl + artifacts[i].fileIdentifyingUrlPathSegment`. Artifacts
 * are the same image at different resolutions. These URLs are signed and expire
 * (see `expiresAt`), which we surface so consumers know not to hotlink long-term.
 */
import type { Entity } from '../normalize.js';

export interface ParsedImage {
  url: string;
  width: number | null;
  height: number | null;
  expiresAt: string | null;
}

interface VectorArtifact {
  width?: number;
  height?: number;
  fileIdentifyingUrlPathSegment?: string;
  expiresAt?: number;
}

interface VectorImage {
  rootUrl?: string;
  artifacts?: VectorArtifact[];
}

/** Dig out the VectorImage from the several shapes it is wrapped in. */
function findVectorImage(node: unknown): VectorImage | null {
  if (!node || typeof node !== 'object') return null;
  const obj = node as Record<string, unknown>;

  if (typeof obj.rootUrl === 'string' && Array.isArray(obj.artifacts)) {
    return obj as VectorImage;
  }
  // Common wrappers: { vectorImage: {...} } and
  // { displayImageReference: { vectorImage: {...} } }
  if (obj.vectorImage) return findVectorImage(obj.vectorImage);
  if (obj.displayImageReference) return findVectorImage(obj.displayImageReference);
  return null;
}

/**
 * Build the image at the largest available resolution (best for a profile picture).
 * Returns null when the node has no usable artifacts.
 */
export function parseImage(node: unknown): ParsedImage | null {
  const vi = findVectorImage(node);
  if (!vi || !vi.rootUrl || !Array.isArray(vi.artifacts) || vi.artifacts.length === 0) {
    return null;
  }
  const largest = [...vi.artifacts]
    .filter((a) => typeof a.fileIdentifyingUrlPathSegment === 'string')
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  if (!largest?.fileIdentifyingUrlPathSegment) return null;

  return {
    url: vi.rootUrl + largest.fileIdentifyingUrlPathSegment,
    width: largest.width ?? null,
    height: largest.height ?? null,
    expiresAt:
      typeof largest.expiresAt === 'number' ? new Date(largest.expiresAt).toISOString() : null,
  };
}

/** Convenience: just the URL of a logo entity's `logo` field. */
export function parseLogoUrl(entity: Entity | null | undefined): string | null {
  if (!entity) return null;
  return parseImage(entity.logo)?.url ?? null;
}
