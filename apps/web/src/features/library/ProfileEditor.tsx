import { useEffect, useRef, useState } from 'react';
import type { EducationItem, Profile, SkillBlock } from '@resume/domain';
import {
  DEGREE_OPTIONS,
  GENDERS,
  emptyEducationItem,
  emptySkillBlock,
} from '@resume/domain';
import { api } from '../../api/client';
import {
  emptyProfileForm,
  profileToForm,
  validateProfileForm,
  type ProfileFormValues,
} from './profileForm';
import { StepDatePicker } from './StepDatePicker';
import './moduleEditor.css';

export interface ProfileEditorProps {
  open: boolean;
  editing: Profile | null;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
  onStatus?: (message: string) => void;
}

export function ProfileEditor({
  open,
  editing,
  onClose,
  onSaved,
  onStatus,
}: ProfileEditorProps) {
  const [values, setValues] = useState<ProfileFormValues>(emptyProfileForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setValues(editing ? profileToForm(editing) : emptyProfileForm());
    setPhotoPreview(
      editing?.hasPhoto
        ? api.profilePhotoUrl(editing.id, editing.updatedAt)
        : null,
    );
  }, [open, editing]);

  if (!open) return null;

  const set = <K extends keyof ProfileFormValues>(
    key: K,
    value: ProfileFormValues[K],
  ) => setValues((v) => ({ ...v, [key]: value }));

  const setEdu = (idx: number, patch: Partial<EducationItem>) => {
    setValues((v) => {
      const education = [...v.education];
      education[idx] = { ...education[idx]!, ...patch };
      return { ...v, education };
    });
  };

  const setSkill = (idx: number, patch: Partial<SkillBlock>) => {
    setValues((v) => {
      const skills = [...v.skills];
      skills[idx] = { ...skills[idx]!, ...patch };
      return { ...v, skills };
    });
  };

  const save = async () => {
    const result = validateProfileForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = editing
        ? await api.updateProfile(editing.id, result.payload)
        : await api.createProfile(result.payload);
      onStatus?.(
        editing ? `已更新基本信息：${saved.name}` : `已创建基本信息：${saved.name}`,
      );
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="moded__backdrop" role="dialog" aria-modal>
      <div className="moded moded--wide">
        <div className="moded__head">
          <h3>{editing ? '编辑基本信息' : '新建基本信息'}</h3>
          <button type="button" className="moded__x" onClick={onClose}>
            ×
          </button>
        </div>

        <p className="moded__hint">
          必填：姓名、性别、邮箱、手机号、微信号。教育 / 技术能力可添加多段。照片上传后，应用到简历即可显示在左侧页眉与导出 DOCX。
        </p>

        <fieldset className="moded__fieldset">
          <legend>身份信息</legend>
          <label>
            姓名 *
            <input
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </label>
          <label>
            性别 *
            <select
              value={values.gender}
              onChange={(e) =>
                set('gender', e.target.value as ProfileFormValues['gender'])
              }
            >
              <option value="">请选择</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label>
            邮箱 *
            <input
              type="email"
              value={values.email}
              onChange={(e) => set('email', e.target.value)}
            />
          </label>
          <label>
            手机号 *
            <input
              value={values.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </label>
          <label>
            微信号 *
            <input
              value={values.wechat}
              onChange={(e) => set('wechat', e.target.value)}
            />
          </label>
          <label>
            QQ（选填）
            <input
              value={values.qq}
              onChange={(e) => set('qq', e.target.value)}
            />
          </label>
          <label>
            城市 / 地点（选填）
            <input
              value={values.location}
              onChange={(e) => set('location', e.target.value)}
            />
          </label>
          <label>
            应聘岗位（选填）
            <input
              value={values.summary}
              placeholder="如：软件工程师"
              onChange={(e) => set('summary', e.target.value)}
            />
          </label>
          <label>
            个人陈述（选填）
            <textarea
              rows={4}
              value={values.statement}
              placeholder="简述个人优势与求职亮点（纯文本，应用到简历后显示在「个人陈述」栏）"
              onChange={(e) => set('statement', e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="moded__fieldset">
          <legend>照片（应用到简历后显示在左侧页眉）</legend>
          <div className="moded__photo-row">
            {photoPreview ? (
              <img src={photoPreview} alt="照片预览" className="moded__thumb" />
            ) : (
              <span className="moded__thumb moded__thumb--empty">无照片</span>
            )}
            <div>
              <button
                type="button"
                className="moded__linkish"
                disabled={busy || !editing}
                onClick={() => fileRef.current?.click()}
              >
                {editing ? '上传 / 更换' : '请先保存卡片后再上传'}
              </button>
              {editing?.hasPhoto && (
                <button
                  type="button"
                  className="moded__linkish"
                  disabled={busy}
                  onClick={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        const p = await api.clearProfilePhoto(editing.id);
                        setPhotoPreview(null);
                        onSaved(p);
                        onStatus?.('已清除照片');
                      } catch (e) {
                        setError(
                          e instanceof Error ? e.message : String(e),
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  清除照片
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file || !editing) return;
                void (async () => {
                  setBusy(true);
                  try {
                    if (file.size > 5 * 1024 * 1024) {
                      throw new Error('照片请小于 5MB');
                    }
                    const mime =
                      file.type ||
                      (file.name.toLowerCase().endsWith('.png')
                        ? 'image/png'
                        : file.name.toLowerCase().endsWith('.webp')
                          ? 'image/webp'
                          : 'image/jpeg');
                    const dataUrl = await readFileAsDataUrl(file);
                    const p = await api.uploadProfilePhoto(
                      editing.id,
                      dataUrl,
                      mime,
                    );
                    setPhotoPreview(
                      api.profilePhotoUrl(p.id, p.updatedAt),
                    );
                    onSaved(p);
                    onStatus?.('照片已保存到基本信息卡');
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : String(err),
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            />
          </div>
        </fieldset>

        <fieldset className="moded__fieldset">
          <legend>教育背景</legend>
          {values.education.map((edu, idx) => (
            <div key={edu.id || idx} className="moded__block">
              <label>
                学校
                <input
                  value={edu.school}
                  onChange={(e) => setEdu(idx, { school: e.target.value })}
                />
              </label>
              <label>
                学历
                <select
                  value={edu.degree?.trim() ?? ''}
                  onChange={(e) => setEdu(idx, { degree: e.target.value })}
                >
                  <option value="">请选择</option>
                  {/* Preserve stored values not in the current option list */}
                  {edu.degree?.trim() &&
                  !(DEGREE_OPTIONS as readonly string[]).includes(
                    edu.degree.trim(),
                  ) ? (
                    <option value={edu.degree.trim()}>
                      {edu.degree.trim()}
                    </option>
                  ) : null}
                  {DEGREE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                专业
                <input
                  value={edu.major ?? ''}
                  onChange={(e) => setEdu(idx, { major: e.target.value })}
                />
              </label>
              <div className="moded__row2">
                <StepDatePicker
                  label="起始时间"
                  value={edu.startDate ?? ''}
                  onChange={(iso) => setEdu(idx, { startDate: iso })}
                  allowClear
                />
                <StepDatePicker
                  label="结束时间"
                  value={edu.endDate ?? ''}
                  onChange={(iso) => setEdu(idx, { endDate: iso })}
                  allowClear
                />
              </div>
              <label>
                GPA
                <input
                  value={edu.gpa ?? ''}
                  placeholder="如 3.57"
                  onChange={(e) => setEdu(idx, { gpa: e.target.value })}
                />
              </label>
              <label>
                GPA 占专业前多少
                <input
                  value={edu.rank ?? ''}
                  placeholder="如 专业前 5%"
                  onChange={(e) => setEdu(idx, { rank: e.target.value })}
                />
              </label>
              <label>
                课程
                <textarea
                  rows={2}
                  value={edu.courses ?? ''}
                  onChange={(e) => setEdu(idx, { courses: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="moded__linkish"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    education: v.education.filter((_, i) => i !== idx),
                  }))
                }
              >
                删除此段教育
              </button>
            </div>
          ))}
          <button
            type="button"
            className="moded__linkish"
            onClick={() =>
              setValues((v) => ({
                ...v,
                education: [...v.education, emptyEducationItem()],
              }))
            }
          >
            + 添加教育经历
          </button>
        </fieldset>

        <fieldset className="moded__fieldset">
          <legend>技术能力</legend>
          {values.skills.map((sk, idx) => (
            <div key={sk.id || idx} className="moded__block">
              <label>
                标题（简历上加粗，如「编程语言」）
                <input
                  value={sk.title}
                  onChange={(e) => setSkill(idx, { title: e.target.value })}
                />
              </label>
              <label>
                正文
                <textarea
                  rows={2}
                  value={sk.body}
                  placeholder="如：Python、Dart、Java"
                  onChange={(e) => setSkill(idx, { body: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="moded__linkish"
                onClick={() =>
                  setValues((v) => ({
                    ...v,
                    skills: v.skills.filter((_, i) => i !== idx),
                  }))
                }
              >
                删除此能力块
              </button>
            </div>
          ))}
          <button
            type="button"
            className="moded__linkish"
            onClick={() =>
              setValues((v) => ({
                ...v,
                skills: [...v.skills, emptySkillBlock()],
              }))
            }
          >
            + 添加技术能力
          </button>
        </fieldset>

        <fieldset className="moded__fieldset">
          <legend>标签与备注</legend>
          <label>
            标签（逗号分隔）
            <input
              value={values.tagsText}
              placeholder="如 校招, 全栈"
              onChange={(e) => set('tagsText', e.target.value)}
            />
          </label>
          <label>
            备注
            <textarea
              rows={2}
              value={values.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </fieldset>

        {error && <p className="moded__error">{error}</p>}

        <div className="moded__foot">
          <button type="button" onClick={onClose} disabled={busy}>
            取消
          </button>
          <button type="button" className="moded__primary" disabled={busy} onClick={() => void save()}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
