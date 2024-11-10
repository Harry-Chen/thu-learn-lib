import { decodeHTML as _decodeHTML } from 'entities';

import { ContentType, FailReason, HomeworkGradeLevel, QuestionnaireType, SemesterType } from './types';

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

const CONTENT_TYPE_MK_MAP = {
  [ContentType.NOTIFICATION]: 'kcgg',
  [ContentType.FILE]: 'kcwj',
  [ContentType.HOMEWORK]: 'kczy',
  [ContentType.DISCUSSION]: '',
  [ContentType.QUESTION]: '',
  [ContentType.QUESTIONNAIRE]: '',
};

export function getMkFromType(type: ContentType): string {
  return 'mk_' + (CONTENT_TYPE_MK_MAP[type] ?? 'UNKNOWN');
}

export function decodeHTML(html: string): string {
  const text = _decodeHTML(html ?? '');
  // remove strange prefixes returned by web learning
  return text.startsWith('\xC2\x9E\xC3\xA9\x65')
    ? text.slice(5)
    : text.startsWith('\x9E\xE9\x65')
      ? text.slice(3)
      : text.startsWith('\xE9\x65')
        ? text.slice(2)
        : text;
}

export function trimAndDefine(text: string | undefined | null): string | undefined {
  if (text === undefined || text === null) {
    return undefined;
  }
  const trimmed = text.trim();
  return trimmed === '' ? undefined : decodeHTML(trimmed);
}

export const GRADE_LEVEL_MAP = new Map([
  [-100, HomeworkGradeLevel.CHECKED],
  [-99, HomeworkGradeLevel.A_PLUS],
  [-98, HomeworkGradeLevel.A],
  [-92, HomeworkGradeLevel.A_MINUS],
  [-87, HomeworkGradeLevel.B_PLUS],
  [-85, HomeworkGradeLevel.DISTINCTION],
  [-82, HomeworkGradeLevel.B],
  [-78, HomeworkGradeLevel.B_MINUS],
  [-74, HomeworkGradeLevel.C_PLUS],
  [-71, HomeworkGradeLevel.C],
  [-68, HomeworkGradeLevel.C_MINUS],
  [-67, HomeworkGradeLevel.G],
  [-66, HomeworkGradeLevel.D_PLUS],
  [-64, HomeworkGradeLevel.D],
  [-65, HomeworkGradeLevel.EXEMPTED_COURSE],
  [-63, HomeworkGradeLevel.PASS],
  [-62, HomeworkGradeLevel.EX],
  [-61, HomeworkGradeLevel.EXEMPTION],
  [-60, HomeworkGradeLevel.PASS],
  [-59, HomeworkGradeLevel.FAILURE],
  [-55, HomeworkGradeLevel.W],
  [-51, HomeworkGradeLevel.I],
  [-50, HomeworkGradeLevel.INCOMPLETE],
  [-31, HomeworkGradeLevel.NA],
  [-30, HomeworkGradeLevel.F],
]);

export const JSONP_EXTRACTOR_NAME = 'thu_learn_lib_jsonp_extractor';

export function extractJSONPResult(jsonp: string): any {
  // check jsonp format
  if (!jsonp.startsWith(JSONP_EXTRACTOR_NAME)) {
    throw FailReason.INVALID_RESPONSE;
  }
  // evaluate the result
  return Function(`"use strict";const ${JSONP_EXTRACTOR_NAME}=(s)=>s;return ${jsonp};`)();
}

export function formatFileSize(size: number): string {
  // this logic is extracted from `judgeSize` function from Web Learning
  if (size < 1024) return size + 'B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + 'K';
  if (size < 1024 * 1024 * 1024) return (size / 1024 / 1024).toFixed(2) + 'M';
  return (size / 1024 / 1024 / 1024).toFixed(2) + 'G';
}

export const CONTENT_TYPE_MAP = new Map([
  [ContentType.NOTIFICATION, 'KCGG'],
  [ContentType.FILE, 'KCKJ'],
  [ContentType.HOMEWORK, 'KCZY'],
  [ContentType.DISCUSSION, 'KCTL'],
  [ContentType.QUESTION, 'KCDY'],
  [ContentType.QUESTIONNAIRE, 'KCWJ'],
  // omitted: 课表(KCKB)
]);
export const CONTENT_TYPE_MAP_REVERSE = new Map([
  [CONTENT_TYPE_MAP.get(ContentType.NOTIFICATION)!, ContentType.NOTIFICATION],
  [CONTENT_TYPE_MAP.get(ContentType.FILE)!, ContentType.FILE],
  [CONTENT_TYPE_MAP.get(ContentType.HOMEWORK)!, ContentType.HOMEWORK],
  [CONTENT_TYPE_MAP.get(ContentType.DISCUSSION)!, ContentType.DISCUSSION],
  [CONTENT_TYPE_MAP.get(ContentType.QUESTION)!, ContentType.QUESTION],
  [CONTENT_TYPE_MAP.get(ContentType.QUESTIONNAIRE)!, ContentType.QUESTIONNAIRE],
]);

export const QNR_TYPE_MAP = new Map([
  ['投票', QuestionnaireType.VOTE],
  ['填表', QuestionnaireType.FORM],
  ['问卷', QuestionnaireType.SURVEY],
]);
