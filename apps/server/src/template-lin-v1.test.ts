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
    assert.equal(LIN_V1_STYLE_PROBE.sectionPt, 14);
    assert.equal(LIN_V1_STYLE_PROBE.bodyPt, 10.5);
    assert.equal(LIN_V1_STYLE_PROBE.contactPt, 9.5);
    assert.equal(LIN_V1_STYLE_PROBE.heiti, '黑体');
    assert.equal(LIN_V1_STYLE_PROBE.song, '宋体');
    assert.equal(LIN_V1_STYLE_PROBE.photoInTemplate, true);
    assert.equal(LIN_V1_STYLE_PROBE.photoPlacement, 'above-name-center');
    assert.deepEqual([...LIN_V1_STYLE_PROBE.sectionOrder], [
      'skills',
      'projects',
      'internships',
      'awards',
    ]);
    assert.equal(LIN_V1_PAGE.width, 11906);
    assert.equal(LIN_V1_PAGE.margin.left, 1020);
  });

  it('renders education + profile skills + entry tabs', () => {
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

    assert.equal(ir.templateVersion, '1.2.1');

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
        b.runs[0]?.text === '编程语言：' &&
        b.runs[1]?.text === 'TypeScript、Python',
    );
    assert.ok(skill && skill.kind === 'paragraph');
    assert.equal(skill.bullet, false);
    assert.equal(skill.runs[0]?.style?.bold, true);

    const entry = ir.blocks.find(
      (b) =>
        b.kind === 'paragraph' &&
        b.entryTabs &&
        b.runs.some((r) => r.text === 'Agent 记忆原型'),
    );
    assert.ok(entry && entry.kind === 'paragraph');
    assert.ok(entry.runs.some((r) => r.text === '\t'));
    const techRun = entry.runs.find((r) => r.text === 'Python');
    assert.ok(techRun);
    assert.equal(techRun.style?.italic, true);
    assert.equal(techRun.style?.fontSizePt, 9.5);
    assert.notEqual(techRun.style?.bold, true);
    assert.ok(entry.runs.some((r) => r.text === '个人项目'));
    assert.ok(entry.runs.some((r) => r.style?.bold && r.text === 'Agent 记忆原型'));
    assert.equal(entry.entryTabs, 4933);

    const bodyParas = ir.blocks.filter(
      (b) =>
        b.kind === 'paragraph' &&
        (b.runs[0]?.text === '语义检索' || b.runs[0]?.text === '跨会话记忆'),
    );
    assert.equal(bodyParas.length, 2);
    for (const b of bodyParas) {
      assert.ok(b.kind === 'paragraph');
      assert.notEqual(b.bullet, true);
      assert.notEqual(b.runs[0]?.style?.bold, true);
      assert.equal(b.runs[0]?.style?.fontEastAsia, '宋体');
      assert.ok(!b.runs[0]?.text.startsWith('•'));
      assert.ok(!/^[一二三四五六七八九十\d]+[、.]/.test(b.runs[0]?.text ?? ''));
    }
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
