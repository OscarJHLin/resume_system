import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  labelsForCategory,
  validateModuleForm,
} from './features/library/moduleForm.js';

describe('wireframe field mapping', () => {
  it('maps 技术栈 label to projectType for projects', () => {
    const labels = labelsForCategory('project');
    assert.match(labels.workstation, /担任的职责/);
    assert.match(labels.projectType, /技术栈/);
    const r = validateModuleForm({
      category: 'project',
      title: '示例项目',
      workstation: '',
      projectType: 'Flutter / Drift',
      timeStart: '2025-01-01',
      timeEnd: '',
      body: '五层空间',
      tagsText: 'Flutter,收纳',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.projectType, 'Flutter / Drift');
      assert.equal(r.payload.timeRange, '2025.01.01 - 至今');
      assert.deepEqual(r.payload.tags, ['Flutter', '收纳']);
    }
  });

  it('primary tabs are project and internship labels', () => {
    assert.match(labelsForCategory('internship').title, /标题/);
    assert.match(labelsForCategory('internship').projectType, /技术栈|岗位/);
  });

  it('custom modules only expose title / time / body', () => {
    const labels = labelsForCategory('custom');
    assert.equal(labels.title, '标题');
    assert.equal(labels.body, '正文');
    assert.equal(labels.showWorkstation, false);
    assert.equal(labels.showProjectType, false);
    assert.equal(labels.showTime, true);
  });
});
