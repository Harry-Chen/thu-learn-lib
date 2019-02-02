import { SemesterType } from './types';

export function parseSemesterType(n: number): SemesterType {
  if (n === 1) {
    return SemesterType.FALL;
  } else if (n === 2) {
    return SemesterType.SRPING;
  } else if (n === 3) {
    return SemesterType.SUMMER;
  } else {
    return SemesterType.UNKNOWN;
  }
}

const HTML_ENTITIES: {
  [key: string]: string;
} = {
  'amp': '&',
  'apos': '\'',
  '#x27': '\'',
  '#x2F': '/',
  '#39': '\'',
  '#47': '/',
  'lt': '<',
  'gt': '>',
  'nbsp': ' ',
  'quot': '"'
};

export function decodeHTMLEntities (text: string): string {
  return text.replace(/&([^;]+);/gm, (match, entity) => {
    return HTML_ENTITIES[entity] || match
  })
}