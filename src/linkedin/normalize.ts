/**
 * LinkedIn's Voyager responses (with the `normalized+json` accept header) come as:
 *
 *   { data: { ...pointers },
 *     included: [ { entityUrn, $type, ...fields, *pointer: "urn:...", }, ... ] }
 *
 * `included` is a FLAT pool of entities keyed by `entityUrn`. Fields whose name
 * starts with `*` are pointers: either a single URN string or an array of URNs
 * into that pool. Collections are two-hop: a `*field` points at a
 * CollectionResponse entity whose `*elements` array points at the real entities.
 *
 * This module builds the index once and resolves those pointers. Every parser
 * works purely off the resulting index, which makes them trivial to unit-test
 * from fixtures and independent of which endpoint produced the data.
 */

export interface Entity {
  entityUrn?: string;
  $type?: string;
  [key: string]: unknown;
}

export interface NormalizedResponse {
  data?: Entity;
  included?: Entity[];
}

const COLLECTION_TYPE = 'com.linkedin.restli.common.CollectionResponse';

export class EntityIndex {
  private readonly map = new Map<string, Entity>();

  constructor(included: Entity[] = []) {
    for (const entity of included) {
      if (entity && typeof entity.entityUrn === 'string') {
        this.map.set(entity.entityUrn, entity);
      }
    }
  }

  get(urn: string | null | undefined): Entity | null {
    if (!urn) return null;
    return this.map.get(urn) ?? null;
  }

  /** All entities whose `$type` ends with the given suffix (e.g. "profile.Position"). */
  byType(typeSuffix: string): Entity[] {
    const out: Entity[] = [];
    for (const entity of this.map.values()) {
      if (typeof entity.$type === 'string' && entity.$type.endsWith(typeSuffix)) {
        out.push(entity);
      }
    }
    return out;
  }

  /** The single entity of a type, or null. Useful for the one Profile entity. */
  firstOfType(typeSuffix: string): Entity | null {
    return this.byType(typeSuffix)[0] ?? null;
  }

  /**
   * Resolve a pointer to a list of entities, transparently following a
   * CollectionResponse wrapper. Accepts a URN string, an array of URNs, or null.
   * Missing entities are skipped rather than throwing — partial data beats a crash.
   */
  resolveCollection(ref: string | string[] | null | undefined): Entity[] {
    const refs = ref == null ? [] : Array.isArray(ref) ? ref : [ref];
    const out: Entity[] = [];
    for (const r of refs) {
      const entity = this.get(r);
      if (!entity) continue;
      if (entity.$type === COLLECTION_TYPE) {
        const elements = entity['*elements'];
        if (Array.isArray(elements)) {
          for (const elUrn of elements) {
            const el = this.get(typeof elUrn === 'string' ? elUrn : null);
            if (el) out.push(el);
          }
        }
      } else {
        out.push(entity);
      }
    }
    return out;
  }

  /** Resolve a pointer to a single entity (first element if it is a collection). */
  resolveOne(ref: string | string[] | null | undefined): Entity | null {
    if (Array.isArray(ref)) return this.resolveCollection(ref)[0] ?? null;
    const entity = this.get(ref);
    if (entity && entity.$type === COLLECTION_TYPE) {
      return this.resolveCollection(ref)[0] ?? null;
    }
    return entity;
  }

  get size(): number {
    return this.map.size;
  }
}

export function buildIndex(response: NormalizedResponse): EntityIndex {
  return new EntityIndex(response.included ?? []);
}

/** The primary Profile entity a `dash/profiles` response resolves to via data.*elements. */
export function rootProfile(response: NormalizedResponse, index: EntityIndex): Entity | null {
  const elements = response.data?.['*elements'];
  if (Array.isArray(elements) && typeof elements[0] === 'string') {
    const viaData = index.get(elements[0]);
    if (viaData) return viaData;
  }
  return index.firstOfType('identity.profile.Profile');
}
