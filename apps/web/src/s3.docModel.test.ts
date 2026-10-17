import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Profile, ResumeDocument } from '@resume/domain';
import {
  SECTION_ORDER,
  buildResumeTipTapDoc,
  listPlacementIdsInDoc,
  listSectionIdsInDoc,
  placementIdsBySectionInDoc,
  placementsForSection,
} from './features/editor/docModel.js';

const profile: Profile = {
  id: 'p1',
  name: '张三',
  phone: '1',
  email: 'zhangsan@example.com',
  location: '上海',
  summary: '简介',
  education: [
    {
      id: 'e1',
      school: '示例大学',
      degree: '本科',
      major: 'CS',
      timeRange: '2018-2022',
    },
  ],
  skills: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resumeWith(
  placements: ResumeDocument['placements'],
): ResumeDocument {
  return {
    id: 'r1',
    title: '测试简历',
    templateId: 'default-v1',
    profileId: 'p1',
    placements,
    customSections: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TipTap doc model bridge (S3)', () => {
  it('projects all sections in stable order', () => {
    const doc = buildResumeTipTapDoc({ resume: null, profile: null });
    assert.deepEqual(listSectionIdsInDoc(doc), [...SECTION_ORDER]);
    assert.equal(doc.content?.[0]?.type, 'resumeMeta');
    assert.equal(doc.content?.[0]?.attrs?.title, '未命名简历');
  });

  it('places snapshot items under the matching section only', () => {
    const resume = resumeWith([
      {
        id: 'pl-intern',
        section: 'internships',
        sortOrder: 0,
        snapshot: {
          sourceModuleId: 'm1',
          category: 'internship',
          title: '示例公司',
          body: '实习助理',
          tags: ['实习'],
          snapshottedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      {
        id: 'pl-proj',
        section: 'projects',
        sortOrder: 0,
        snapshot: {
          sourceModuleId: 'm2',
          category: 'project',
          title: '简历系统',
          body: '组装',
          tags: ['简历'],
          snapshottedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    ]);

    assert.equal(placementsForSection(resume, 'internships').length, 1);
    assert.equal(placementsForSection(resume, 'projects').length, 1);

    const doc = buildResumeTipTapDoc({ resume, profile });
    assert.deepEqual(listPlacementIdsInDoc(doc), ['pl-proj', 'pl-intern']);
    assert.deepEqual(placementIdsBySectionInDoc(doc), {
      basic: [],
      education: [],
      skills: [],
      projects: ['pl-proj'],
      internships: ['pl-intern'],
      campuses: [],
      awards: [],
    });
  });

  it('hydrates profile fields into projection nodes', () => {
    const doc = buildResumeTipTapDoc({ resume: resumeWith([]), profile });
    const basic = doc.content?.find(
      (n) => n.type === 'resumeSection' && n.attrs?.sectionId === 'basic',
    );
    const profileNode = basic?.content?.find((n) => n.type === 'profileBasic');
    assert.equal(profileNode?.attrs?.name, '张三');
    assert.match(String(profileNode?.attrs?.contact ?? ''), /上海/);
  });

  it('re-hydrate after placement reflects new snapshot id (sync model)', () => {
    const before = buildResumeTipTapDoc({
      resume: resumeWith([]),
      profile,
    });
    assert.deepEqual(listPlacementIdsInDoc(before), []);

    const afterResume = resumeWith([
      {
        id: 'pl-new',
        section: 'internships',
        sortOrder: 0,
        snapshot: {
          sourceModuleId: 'm3',
          category: 'internship',
          title: '实习',
          body: '后端',
          tags: [],
          snapshottedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    ]);
    const after = buildResumeTipTapDoc({ resume: afterResume, profile });
    assert.deepEqual(placementIdsBySectionInDoc(after).internships, ['pl-new']);
  });
});
