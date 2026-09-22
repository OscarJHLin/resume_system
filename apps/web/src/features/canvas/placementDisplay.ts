import {
  displayModuleTimeRange,
  type ModuleSnapshot,
  type SectionId,
} from '@resume/domain';

/**
 * Fields shown on the resume canvas for a placement snapshot.
 * Always surfaces title, subtitle (担任的职责/部门), projectType (技术栈/岗位),
 * timeRange, and body — never drop a saved field when another is present.
 * Awards: projectType = 级别, subtitle = 颁发机构.
 */
export function placementDisplayFields(
  snapshot: ModuleSnapshot,
  section: SectionId,
): {
  title: string;
  /** Tech stack / role / 级别 — styled smaller + italic on canvas. */
  projectType: string;
  /** Duty / department / 颁发机构 — mid column beside tech. */
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
  const timeRange = displayModuleTimeRange(snapshot.timeRange);
  const bodyLines = (snapshot.body ?? '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (section === 'awards') {
    // 名称，级别，颁发机构，时间，补充说明
    return {
      title,
      projectType,
      subtitle,
      middle: [projectType, subtitle].filter(Boolean).join(' · '),
      timeRange,
      bodyLines,
      awardLine: [title, projectType, subtitle, timeRange, bodyLines.join(' ')]
        .filter(Boolean)
        .join('，'),
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
