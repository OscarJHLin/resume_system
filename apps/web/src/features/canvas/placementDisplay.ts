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
  /** Tech stack / role — styled smaller + italic on canvas. */
  projectType: string;
  /** Duty / department — mid column beside tech. */
  subtitle: string;
  /** Joined mid for tests / plain consumers. */
  middle: string;
  timeRange: string;
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
      projectType: '',
      subtitle: '',
      middle: '',
      timeRange,
      bodyLines,
      awardLine: [title, timeRange, bodyLines.join(' ')].filter(Boolean).join('，'),
    };
  }

  const middle = [projectType, subtitle].filter(Boolean).join(' · ');
  return {
    title,
    projectType,
    subtitle,
    middle,
    timeRange,
    bodyLines,
  };
}
