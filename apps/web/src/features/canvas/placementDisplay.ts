import type { ModuleSnapshot, SectionId } from '@resume/domain';

/**
 * Fields shown on the resume canvas for a placement snapshot.
 * Always surfaces title, subtitle (担任的职责/部门), projectType (技术栈/岗位),
 * timeRange, and body — never drop a saved field when another is present.
 */
export function placementDisplayFields(
  snapshot: ModuleSnapshot,
  section: SectionId,
): {
  title: string;
  middle: string;
  timeRange: string;
  subtitleLine: string;
  bodyLines: string[];
  awardLine?: string;
} {
  const title = snapshot.title ?? '';
  const subtitle = (snapshot.subtitle ?? '').trim();
  const projectType = (snapshot.projectType ?? '').trim();
  const timeRange = (snapshot.timeRange ?? '').trim();
  const bodyLines = (snapshot.body ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (section === 'awards') {
    return {
      title,
      middle: '',
      timeRange,
      subtitleLine: '',
      bodyLines,
      awardLine: [title, timeRange, bodyLines.join(' ')].filter(Boolean).join('，'),
    };
  }

  // Mid column: tech/role first, then duty/location — both when present
  const middle = [projectType, subtitle].filter(Boolean).join(' · ');
  return {
    title,
    middle,
    timeRange,
    subtitleLine: '',
    bodyLines,
  };
}
