import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import { exportDocx, LIN_V1_PAGE } from './modules/export/index.js';
import {
  LIN_V1_STYLE_PROBE,
  renderToIR,
} from './modules/template/index.js';

describe('lin-v1 / default-v1 template fidelity', () => {
  it('locks typography probes from reference DOCX (参考简历模板)', () => {
    assert.equal(LIN_V1_STYLE_PROBE.namePt, 22);
    assert.equal(LIN_V1_STYLE_PROBE.sectionPt, 13);
    assert.equal(LIN_V1_STYLE_PROBE.bodyPt, 10.5);
    assert.equal(LIN_V1_STYLE_PROBE.contactPt, 9.5);
    assert.equal(LIN_V1_STYLE_PROBE.heiti, '黑体');
    assert.equal(LIN_V1_STYLE_PROBE.song, '宋体');
    assert.equal(LIN_V1_STYLE_PROBE.photoInTemplate, false);
    assert.deepEqual([...LIN_V1_STYLE_PROBE.sectionOrder], [
      'skills',
      'projects',
      'internships',
      'awards',
    ]);
    assert.equal(LIN_V1_PAGE.width, 11906);
    assert.equal(LIN_V1_PAGE.margin.left, 1020);
  });

  it('renders education + profile skills + entry tabs (no photo)', () => {
    const ir = renderToIR(
      {
        templateId: DEFAULT_TEMPLATE_ID,
        profile: {
          id: 'p1',
          name: '张三',
          gender: '男',
          phone: '15000000000',
          email: 'a@b.c',
          wechat: 'wx_demo',
          location: '示例市',
          summary: '软件工程本科生 · AI 应用',
          education: [
            {
              id: 'e1',
              school: '示例学院',
              degree: '本科',
              major: '软件工程',
              timeRange: '2023.09 - 2027.06',
              gpa: '3.57',
              rank: '专业前 5%',
            },
          ],
          skills: [
            { id: 's1', title: '编程语言', body: 'TypeScript、Python' },
          ],
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        placements: [
          {
            id: 'pj',
            section: 'projects',
            sortOrder: 0,
            snapshot: {
              sourceModuleId: 'm2',
              category: 'project',
              title: 'Agent 记忆原型',
              subtitle: '个人项目',
              projectType: 'Python',
              timeRange: '2025',
              body: '语义检索\n跨会话记忆',
              tags: [],
              snapshottedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      },
      () => '2026-09-23T00:00:00.000Z',
    );

    assert.equal(ir.templateVersion, '1.0.0');

    const eduHead = ir.blocks.find(
      (b) =>
        b.kind === 'heading' &&
        b.level === 2 &&
        b.runs[0]?.text === '教育背景',
    );
    assert.ok(eduHead && eduHead.kind === 'heading');
    assert.equal(eduHead.borderBottom, true);

    const skill = ir.blocks.find(
      (b) =>
        b.kind === 'paragraph' &&
        b.runs[0]?.text === '编程语言：TypeScript、Python',
    );
    assert.ok(skill && skill.kind === 'paragraph');
    assert.equal(skill.bullet, true);
    assert.equal(skill.runs[0]?.style?.bold, true);

    const entry = ir.blocks.find(
      (b) =>
        b.kind === 'paragraph' &&
        b.entryTabs &&
        b.runs.some((r) => r.text === 'Agent 记忆原型'),
    );
    assert.ok(entry && entry.kind === 'paragraph');
    assert.ok(entry.runs.some((r) => r.text === '\t'));
  });

  it('exported docx is non-empty OOXML', async () => {
    const ir = renderToIR({
      templateId: DEFAULT_TEMPLATE_ID,
      profile: {
        id: 'p1',
        name: '张三',
        location: '示例市',
        education: [],
        skills: [],
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      placements: [],
    });
    const buf = await exportDocx(ir);
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
    assert.ok(buf.length > 1500);
  });
});
