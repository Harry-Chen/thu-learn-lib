import { decodeHTML } from 'entities';

import { SemesterType, FailReason } from './types';

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

export function trimAndDefine(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed === '' ? undefined : decodeHTML(trimmed);
}

const GRADE_LEVEL_MAP = new Map([
  [-100, '已阅'],
  [-99, 'A+'],
  [-98, 'A'],
  [-92, 'A-'],
  [-87, 'B+'],
  [-85, '优秀'],
  [-82, 'B'],
  [-78, 'B-'],
  [-74, 'C+'],
  [-71, 'C'],
  [-68, 'C-'],
  [-67, 'G'],
  [-66, 'D+'],
  [-64, 'D'],
  [-65, '免课'],
  [-63, 'P'],
  [-62, 'EX'],
  [-61, '免修'],
  [-60, '通过'],
  [-59, '不通过'],
  [-55, 'W'],
  [-51, 'I'],
  [-50, '缓考'],
  [-31, 'NA'],
  [-30, 'F'],
]);

export function mapGradeToLevel(grade: number | null): string | undefined {
  if (grade !== null && GRADE_LEVEL_MAP.has(grade)) {
    return GRADE_LEVEL_MAP.get(grade)!!;
  } else {
    return undefined;
  }
}

export const JSONP_EXTRACTOR_NAME = 'thu_learn_lib_jsonp_extractor';

export function extractJSONPResult(jsonp: string): any {
  // check jsonp format
  if (!jsonp.startsWith(JSONP_EXTRACTOR_NAME)) {
    throw FailReason.INVALID_RESPONSE;
  }
  // evaluate the result
  return Function(`"use strict";const ${JSONP_EXTRACTOR_NAME}=(s)=>s;return ${jsonp};`)();
}
