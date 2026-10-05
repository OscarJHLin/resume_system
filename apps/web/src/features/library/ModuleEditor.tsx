import { useEffect, useMemo, useState } from 'react';
import type { Category, ContentModule, LibraryModuleCategory } from '@resume/domain';
import { LIBRARY_MODULE_CATEGORIES } from '@resume/domain';
import { api } from '../../api/client';
import {
  emptyForm,
  labelsForCategory,
  moduleToForm,
  validateModuleForm,
  type ModuleFormValues,
} from './moduleForm';
import { StepDatePicker } from './StepDatePicker';
import './moduleEditor.css';

const CATEGORY_LABEL: Record<LibraryModuleCategory, string> = {
  project: '项目经历',
  internship: '实习经历',
  award: '获奖与证书',
  custom: '自定义',
};

export interface ModuleEditorProps {
  /** null = create mode */
  editing: ContentModule | null;
  open: boolean;
  /** Used when creating */
  defaultCategory?: Category;
  onClose: () => void;
  onSaved: (mod: ContentModule) => void;
  onStatus?: (message: string) => void;
}

export function ModuleEditor({
  editing,
  open,
  defaultCategory = 'project',
  onClose,
  onSaved,
  onStatus,
}: ModuleEditorProps) {
  const initialCat: LibraryModuleCategory =
    defaultCategory === 'internship' ||
    defaultCategory === 'award' ||
    defaultCategory === 'custom'
      ? defaultCategory
      : 'project';
  const [values, setValues] = useState<ModuleFormValues>(emptyForm(initialCat));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(editing ? moduleToForm(editing) : emptyForm(initialCat));
  }, [open, editing, initialCat]);

  const labels = useMemo(
    () => labelsForCategory(values.category),
    [values.category],
  );

  if (!open) return null;

  const set = <K extends keyof ModuleFormValues>(
    key: K,
    value: ModuleFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const save = async () => {
    const result = validateModuleForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mod = editing
        ? await api.updateModule(editing.id, result.payload)
        : await api.createModule(result.payload);
      onStatus?.(
        editing
          ? `已更新模块：${mod.title}（若已在简历中，请删除旧条目后重新拖入）`
          : `已创建模块：${mod.title}`,
      );
      onSaved(mod);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moded__backdrop" role="dialog" aria-modal="true">
      <div className="moded">
        <header className="moded__head">
          <h3>{editing ? '编辑经历模块' : '新建经历模块'}</h3>
          <button type="button" className="moded__x" onClick={onClose}>
            关闭
          </button>
        </header>
        <p className="moded__guide">
          按字段填写后入库，可供标签检索与拖入简历。带「可留空」的项可跳过；标题必填。
          时间请点选日期；仅填开始或起止均可。
        </p>

        <label className="moded__field">
          <span>大类</span>
          <select
            value={
              values.category === 'skill' ? 'project' : values.category
            }
            disabled={Boolean(editing)}
            onChange={(e) =>
              set('category', e.target.value as LibraryModuleCategory)
            }
          >
            {LIBRARY_MODULE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="moded__field">
          <span>{labels.title} *</span>
          <input
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="必填"
          />
        </label>

        {labels.showTime && (
          <fieldset className="moded__time">
            <legend>{labels.time}</legend>
            <StepDatePicker
              label="开始"
              value={values.timeStart}
              onChange={(iso) => set('timeStart', iso)}
              allowClear
            />
            <StepDatePicker
              label="结束（可留空 → 至今）"
              value={values.timeEnd}
              onChange={(iso) => set('timeEnd', iso)}
              allowClear
            />
            {values.timeStart && !values.timeEnd ? (
              <p className="moded__hint">结束未填时，简历上显示为「至今」</p>
            ) : null}
            <button
              type="button"
              className="moded__linkish"
              onClick={() => {
                set('timeStart', '');
                set('timeEnd', '');
              }}
            >
              清空时间
            </button>
          </fieldset>
        )}

        {labels.showWorkstation && (
          <label className="moded__field">
            <span>{labels.workstation}</span>
            <input
              value={values.workstation}
              onChange={(e) => set('workstation', e.target.value)}
              placeholder="可留空"
            />
          </label>
        )}

        {labels.showProjectType && (
          <label className="moded__field">
            <span>{labels.projectType}</span>
            <input
              value={values.projectType}
              onChange={(e) => set('projectType', e.target.value)}
              placeholder="例如：个人项目 / 全栈"
            />
          </label>
        )}

        <label className="moded__field">
          <span>{labels.body}</span>
          <textarea
            rows={6}
            value={values.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="纯文本，换行保留"
          />
        </label>

        {values.category !== 'custom' && (
          <label className="moded__field">
            <span>{labels.tags}</span>
            <input
              value={values.tagsText}
              onChange={(e) => set('tagsText', e.target.value)}
              placeholder="TypeScript, 简历"
            />
          </label>
        )}

        {error && (
          <p className="moded__error" role="alert">
            {error}
          </p>
        )}

        <footer className="moded__foot">
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="moded__primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? '保存中…' : '保存到内容库'}
          </button>
        </footer>
      </div>
    </div>
  );
}
