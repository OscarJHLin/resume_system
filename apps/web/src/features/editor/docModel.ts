import type { JSONContent } from '@tiptap/core';
import type {
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
} from '@resume/domain';
import {
  DEFAULT_TEMPLATE_ID,
  SECTION_LABELS,
  isPlaceableSection,
} from '@resume/domain';

/** Stable section order for the TipTap document projection. */
export const SECTION_ORDER: readonly SectionId[] = [
  'basic',
  'education',
  'skills',
  'projects',
  'internships',
  'campuses',
  'awards',
] as const;

export function placementsForSection(
  resume: ResumeDocument | null,
  sectionId: string,
): SectionPlacement[] {
  if (!resume) return [];
  return resume.placements
    .filter((p) => p.section === sectionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Build TipTap JSON from server ResumeDocument + Profile.
 * TipTap is a projection only — export still uses placements → ResumeIR.
 */
export function buildResumeTipTapDoc(input: {
  resume: ResumeDocument | null;
  profile: Profile | null;
}): JSONContent {
  const title = input.resume?.title ?? '未命名简历';
  const templateId = input.resume?.templateId ?? DEFAULT_TEMPLATE_ID;

  return {
    type: 'doc',
    content: [
      {
        type: 'resumeMeta',
        attrs: { templateId, title },
      },
      ...SECTION_ORDER.map((sectionId) =>
        buildSectionNode(sectionId, input.resume, input.profile),
      ),
    ],
  };
}

function buildSectionNode(
  sectionId: SectionId,
  resume: ResumeDocument | null,
  profile: Profile | null,
): JSONContent {
  const placeable = isPlaceableSection(sectionId);
  const content: JSONContent[] = [];

  if (sectionId === 'basic') {
    content.push(buildProfileBasicNode(profile));
  } else if (sectionId === 'education') {
    content.push(buildProfileEducationNode(profile));
  }

  if (placeable) {
    const placements = placementsForSection(resume, sectionId);
    for (const p of placements) {
      content.push(buildPlacementNode(p, sectionId));
    }
    content.push({
      type: 'dropHint',
      attrs: { empty: placements.length === 0 },
    });
  }

  return {
    type: 'resumeSection',
    attrs: {
      sectionId,
      label: SECTION_LABELS[sectionId],
      placeable,
    },
    content,
  };
}

function buildProfileBasicNode(profile: Profile | null): JSONContent {
  if (!profile) {
    return {
      type: 'profileBasic',
      attrs: {
        name: '',
        contact: '',
        summary: '',
        loading: true,
      },
    };
  }
  const contact = [profile.phone, profile.email, profile.location]
    .filter(Boolean)
    .join(' · ');
  return {
    type: 'profileBasic',
    attrs: {
      name: profile.name,
      contact,
      summary: profile.summary ?? '',
      loading: false,
    },
  };
}

function buildProfileEducationNode(profile: Profile | null): JSONContent {
  const lines =
    profile?.education.map((e) =>
      [e.school, e.degree, e.major, e.timeRange].filter(Boolean).join(' · '),
    ) ?? [];
  return {
    type: 'profileEducation',
    attrs: {
      linesJson: JSON.stringify(lines),
    },
  };
}

function buildPlacementNode(
  p: SectionPlacement,
  sectionId: SectionId,
): JSONContent {
  const s = p.snapshot;
  return {
    type: 'placementItem',
    attrs: {
      placementId: p.id,
      sectionId,
      title: s.title,
      subtitle: s.subtitle ?? '',
      projectType: s.projectType ?? '',
      timeRange: s.timeRange ?? '',
      body: s.body,
    },
  };
}

/** Collect placementIds in document order (for sync tests). */
export function listPlacementIdsInDoc(doc: JSONContent): string[] {
  const ids: string[] = [];
  walk(doc, (node) => {
    if (node.type === 'placementItem' && typeof node.attrs?.placementId === 'string') {
      ids.push(node.attrs.placementId);
    }
  });
  return ids;
}

export function listSectionIdsInDoc(doc: JSONContent): string[] {
  const ids: string[] = [];
  walk(doc, (node) => {
    if (node.type === 'resumeSection' && typeof node.attrs?.sectionId === 'string') {
      ids.push(node.attrs.sectionId);
    }
  });
  return ids;
}

/** Placement IDs grouped by sectionId as projected into TipTap. */
export function placementIdsBySectionInDoc(
  doc: JSONContent,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const node of doc.content ?? []) {
    if (node.type !== 'resumeSection') continue;
    const sectionId = String(node.attrs?.sectionId ?? '');
    out[sectionId] = [];
    for (const child of node.content ?? []) {
      if (
        child.type === 'placementItem' &&
        typeof child.attrs?.placementId === 'string'
      ) {
        out[sectionId].push(child.attrs.placementId);
      }
    }
  }
  return out;
}

function walk(node: JSONContent, visit: (n: JSONContent) => void): void {
  visit(node);
  for (const child of node.content ?? []) {
    walk(child, visit);
  }
}
