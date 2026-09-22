import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  labelsForCategory,
  validateModuleForm,
} from './features/library/moduleForm.js';

describe('wireframe field mapping', () => {
  it('maps 技术栈 label to projectType for projects', () => {
    const labels = labelsForCategory('project');
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
      assert.equal(r.payload.timeRange, '2025.01.01');
      assert.deepEqual(r.payload.tags, ['Flutter', '收纳']);
    }
  });

  it('primary tabs are project and internship labels', () => {
    assert.match(labelsForCategory('internship').title, /标题/);
    assert.match(labelsForCategory('internship').projectType, /技术栈|岗位/);
  });
});
