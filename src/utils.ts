import { SemesterType } from './types';

export function parseSemesterType(n: number): SemesterType {
  if (n === 1) {
    return SemesterType.FALL;
  } else if (n === 2) {
    return SemesterType.SPRING;
  } else if (n === 3) {
    return SemesterType.SUMMER;
  } else {
    return SemesterType.UNKNOWN;
  }
}

const HTML_ENTITIES: {
  [key: string]: string;
} = {
  amp: '&',
  apos: "'",
  '#x27': "'",
  '#x2F': '/',
  '#39': "'",
  '#47': '/',
  mdash: '—',
  middit: '·',
  cap: '∩',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  quot: '"',
  ldquo: '“',
  rdquo: '”',
};

export function decodeHTMLEntities(text: string): string {
  return text.replace(/&([^;]+);/gm, (match, entity) => {
    return HTML_ENTITIES[entity] || match;
  });
}

export function trimAndDefine(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}
