import type {
  EducationItem,
  Gender,
  Profile,
  SkillBlock,
} from '@resume/domain';
import {
  emptyEducationItem,
  emptySkillBlock,
  validateProfileRequired,
} from '@resume/domain';
import type { ProfilePayload } from '../../api/client';

export interface ProfileFormValues {
  name: string;
  gender: Gender | '';
  email: string;
  phone: string;
  wechat: string;
  qq: string;
  location: string;
  summary: string;
  statement: string;
  education: EducationItem[];
  skills: SkillBlock[];
  tagsText: string;
  notes: string;
}

export function emptyProfileForm(): ProfileFormValues {
  return {
    name: '',
    gender: '',
    email: '',
    phone: '',
    wechat: '',
    qq: '',
    location: '',
    summary: '',
    statement: '',
    education: [emptyEducationItem()],
    skills: [emptySkillBlock()],
    tagsText: '',
    notes: '',
  };
}

export function profileToForm(p: Profile): ProfileFormValues {
  return {
    name: p.name,
    gender: (p.gender as Gender) || '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    wechat: p.wechat ?? '',
    qq: p.qq ?? '',
    location: p.location ?? '',
    summary: p.summary ?? '',
    statement: p.statement ?? '',
    education: p.education.length
      ? p.education.map((e) => ({
          ...e,
          // Keep form select in sync with stored degree (avoid display-only 「本科」)
          degree: e.degree?.trim() || '本科',
        }))
      : [emptyEducationItem()],
    skills: p.skills.length
      ? p.skills.map((s) => ({ ...s }))
      : [emptySkillBlock()],
    tagsText: p.tags.join(', '),
    notes: p.notes ?? '',
  };
}

export function parseTagsText(text: string): string[] {
  return text
    .split(/[,，\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function validateProfileForm(
  values: ProfileFormValues,
): { ok: true; payload: ProfilePayload } | { ok: false; error: string } {
  const checked = validateProfileRequired({
    name: values.name,
    gender: values.gender,
    email: values.email,
    phone: values.phone,
    wechat: values.wechat,
  });
  if (!checked.ok) return checked;

  const education = values.education
    .map((e) => ({
      ...e,
      school: e.school.trim(),
    }))
    .filter(
      (e) =>
        e.school ||
        e.major ||
        e.gpa ||
        e.rank ||
        e.courses ||
        e.startDate ||
        e.endDate,
    );

  const skills = values.skills
    .map((s) => ({
      id: s.id,
      title: s.title.trim(),
      body: s.body.trim(),
    }))
    .filter((s) => s.title || s.body);

  return {
    ok: true,
    payload: {
      name: values.name.trim(),
      gender: values.gender,
      email: values.email.trim(),
      phone: values.phone.trim(),
      wechat: values.wechat.trim(),
      qq: values.qq.trim() || undefined,
      location: values.location.trim() || undefined,
      summary: values.summary.trim() || undefined,
      statement: values.statement.trim() || undefined,
      education,
      skills,
      tags: parseTagsText(values.tagsText),
      notes: values.notes.trim() || undefined,
    },
  };
}

export function profileCardSummary(p: Profile): string {
  const bits = [p.gender, p.phone, p.email].filter(Boolean);
  return bits.join(' · ') || '基本信息卡';
}
