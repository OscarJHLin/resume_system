import type {
  ContentModule,
  EducationItem,
  ModuleSnapshot,
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
  SkillBlock,
  TemplateId,
} from '@resume/domain';
import {
  DEFAULT_TEMPLATE_ID,
  educationTimeRange,
  validateProfileRequired,
} from '@resume/domain';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './client.js';
import { defaultDbPath, photosDir } from './client.js';
import { newId, nowIso } from '../util.js';
import { badRequest, notFound } from '../errors.js';
import { isRegisteredTemplateId } from '../modules/template/registry.js';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

type ProfileRow = {
  id: string;
  name: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  qq: string | null;
  location: string | null;
  summary: string | null;
  statement: string | null;
  education_json: string;
  skills_json: string | null;
  tags_json: string | null;
  notes: string | null;
  photo_filename?: string | null;
  created_at: string | null;
  updated_at: string;
};

export type ProfileInput = {
  name: string;
  gender: string;
  phone: string;
  email: string;
  wechat: string;
  qq?: string;
  location?: string;
  summary?: string;
  statement?: string;
  education?: EducationItem[];
  skills?: SkillBlock[];
  tags?: string[];
  notes?: string;
};

export class Store {
  constructor(
    private readonly db: Db,
    private readonly dbPath: string = defaultDbPath(),
  ) {}

  listProfiles(filter: { q?: string; tag?: string } = {}): Profile[] {
    const rows = this.db
      .prepare('SELECT * FROM profile ORDER BY updated_at DESC')
      .all() as ProfileRow[];
    return rows
      .map((r) => this.rowToProfile(r))
      .filter((p) => {
        if (filter.tag) {
          const needle = filter.tag.toLowerCase();
          if (!p.tags.some((t) => t.toLowerCase().includes(needle))) {
            return false;
          }
        }
        if (filter.q) {
          const q = filter.q.toLowerCase();
          const hay = [
            p.name,
            p.email,
            p.phone,
            p.wechat,
            p.summary,
            p.statement,
            p.notes,
            ...p.tags,
            ...p.education.map((e) => e.school),
            ...p.skills.map((s) => `${s.title} ${s.body}`),
          ]
            .filter(Boolean)
            .join('\n')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }

  getProfileById(id: string): Profile {
    const row = this.db.prepare('SELECT * FROM profile WHERE id = ?').get(id) as
      | ProfileRow
      | undefined;
    if (!row) throw notFound(`Profile ${id} not found`);
    return this.rowToProfile(row);
  }

  /** @deprecated Prefer getProfileById — returns first profile if any. */
  getProfile(): Profile {
    const row = this.db.prepare('SELECT * FROM profile LIMIT 1').get() as
      | ProfileRow
      | undefined;
    if (!row) throw notFound('Profile not found');
    return this.rowToProfile(row);
  }

  createProfile(input: ProfileInput): Profile {
    const checked = validateProfileRequired(input);
    if (!checked.ok) throw badRequest(checked.error);

    const ts = nowIso();
    const education = normalizeEducation(input.education);
    const skills = normalizeSkills(input.skills);
    const profile: Profile = {
      id: newId(),
      name: input.name.trim(),
      gender: input.gender.trim() as Profile['gender'],
      phone: input.phone.trim(),
      email: input.email.trim(),
      wechat: input.wechat.trim(),
      qq: input.qq?.trim() || undefined,
      location: input.location?.trim() || undefined,
      summary: input.summary?.trim() || undefined,
      statement: input.statement?.trim() || undefined,
      education,
      skills,
      tags: normalizeTags(input.tags),
      notes: input.notes?.trim() || undefined,
      createdAt: ts,
      updatedAt: ts,
    };
    this.db
      .prepare(
        `INSERT INTO profile (
          id, name, gender, phone, email, wechat, qq, location, summary,
          statement, education_json, skills_json, tags_json, notes, photo_filename,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        profile.id,
        profile.name,
        profile.gender ?? null,
        profile.phone ?? null,
        profile.email ?? null,
        profile.wechat ?? null,
        profile.qq ?? null,
        profile.location ?? null,
        profile.summary ?? null,
        profile.statement ?? null,
        JSON.stringify(profile.education),
        JSON.stringify(profile.skills),
        JSON.stringify(profile.tags),
        profile.notes ?? null,
        null,
        profile.createdAt,
        profile.updatedAt,
      );
    return this.getProfileById(profile.id);
  }

  updateProfile(id: string, input: ProfileInput): Profile {
    this.getProfileById(id);
    const checked = validateProfileRequired(input);
    if (!checked.ok) throw badRequest(checked.error);

    const education = normalizeEducation(input.education);
    const skills = normalizeSkills(input.skills);
    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE profile SET
          name = ?, gender = ?, phone = ?, email = ?, wechat = ?, qq = ?,
          location = ?, summary = ?, statement = ?, education_json = ?, skills_json = ?,
          tags_json = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        input.name.trim(),
        input.gender.trim(),
        input.phone.trim(),
        input.email.trim(),
        input.wechat.trim(),
        input.qq?.trim() || null,
        input.location?.trim() || null,
        input.summary?.trim() || null,
        input.statement?.trim() || null,
        JSON.stringify(education),
        JSON.stringify(skills),
        JSON.stringify(normalizeTags(input.tags)),
        input.notes?.trim() || null,
        updatedAt,
        id,
      );
    return this.getProfileById(id);
  }

  deleteProfile(id: string): void {
    this.getProfileById(id);
    this.clearProfilePhoto(id);
    this.db.prepare('DELETE FROM profile WHERE id = ?').run(id);
    // Detach resumes that pointed at this card
    this.db
      .prepare(
        `UPDATE resume SET profile_id = '', updated_at = ? WHERE profile_id = ?`,
      )
      .run(nowIso(), id);
  }

  saveProfilePhoto(profileId: string, bytes: Buffer, ext: string): Profile {
    this.getProfileById(profileId);
    const safeExt = ext.replace(/^\./, '').toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(safeExt)) {
      throw badRequest('photo must be jpg, png, or webp');
    }
    const filename = `${profileId}.${safeExt === 'jpeg' ? 'jpg' : safeExt}`;
    const dir = photosDir(this.dbPath);
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(`${profileId}.`)) fs.unlinkSync(path.join(dir, f));
    }
    // Also clear legacy singleton filenames if migrating
    for (const legacy of ['profile.jpg', 'profile.png', 'profile.webp']) {
      const full = path.join(dir, legacy);
      if (fs.existsSync(full)) {
        /* keep other profiles' files; only remove when this is sole legacy */
      }
    }
    fs.writeFileSync(path.join(dir, filename), bytes);
    this.db
      .prepare(
        'UPDATE profile SET photo_filename = ?, updated_at = ? WHERE id = ?',
      )
      .run(filename, nowIso(), profileId);
    return this.getProfileById(profileId);
  }

  clearProfilePhoto(profileId: string): Profile {
    const row = this.db
      .prepare('SELECT photo_filename FROM profile WHERE id = ?')
      .get(profileId) as { photo_filename: string | null } | undefined;
    if (!row) throw notFound(`Profile ${profileId} not found`);
    if (row.photo_filename) {
      const full = path.join(photosDir(this.dbPath), row.photo_filename);
      if (fs.existsSync(full)) fs.unlinkSync(full);
    }
    this.db
      .prepare(
        'UPDATE profile SET photo_filename = NULL, updated_at = ? WHERE id = ?',
      )
      .run(nowIso(), profileId);
    return this.getProfileById(profileId);
  }

  getProfilePhoto(
    profileId: string,
  ): { buffer: Buffer; mime: string; filename: string } | null {
    const row = this.db
      .prepare('SELECT photo_filename FROM profile WHERE id = ?')
      .get(profileId) as { photo_filename: string | null } | undefined;
    if (!row?.photo_filename) return null;
    const full = path.join(photosDir(this.dbPath), row.photo_filename);
    if (!fs.existsSync(full)) return null;
    const ext = path.extname(row.photo_filename).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    return {
      buffer: fs.readFileSync(full),
      mime,
      filename: row.photo_filename,
    };
  }

  private rowToProfile(row: ProfileRow): Profile {
    const name = row.photo_filename ?? null;
    const photoPath = name
      ? path.join(photosDir(this.dbPath), name)
      : null;
    // Legacy singleton photo filename support
    let hasPhoto = Boolean(photoPath && fs.existsSync(photoPath));
    if (!hasPhoto && name === null) {
      const legacy = path.join(photosDir(this.dbPath), 'profile.jpg');
      if (fs.existsSync(legacy)) hasPhoto = true;
    }
    return {
      id: row.id,
      name: row.name,
      gender: (row.gender as Profile['gender']) || '',
      phone: row.phone ?? undefined,
      email: row.email ?? undefined,
      wechat: row.wechat ?? undefined,
      qq: row.qq ?? undefined,
      location: row.location ?? undefined,
      summary: row.summary ?? undefined,
      statement: row.statement ?? undefined,
      education: parseJson<EducationItem[]>(row.education_json, []),
      skills: parseJson<SkillBlock[]>(row.skills_json, []),
      tags: parseJson<string[]>(row.tags_json, []),
      notes: row.notes ?? undefined,
      hasPhoto,
      createdAt: row.created_at || row.updated_at,
      updatedAt: row.updated_at,
    };
  }

  listModules(filter: {
    category?: string;
    tag?: string;
    q?: string;
  }): ContentModule[] {
    const rows = this.db
      .prepare('SELECT * FROM content_module ORDER BY updated_at DESC')
      .all() as Array<{
      id: string;
      category: string;
      title: string;
      subtitle: string | null;
      project_type: string | null;
      time_range: string | null;
      body: string;
      tags_json: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows
      .map((row) => this.rowToModule(row))
      .filter((m) => {
        if (filter.category && m.category !== filter.category) return false;
        if (filter.tag) {
          const needle = filter.tag.toLowerCase();
          if (!m.tags.some((t) => t.toLowerCase().includes(needle))) {
            return false;
          }
        }
        if (filter.q) {
          const q = filter.q.toLowerCase();
          const hay = [m.title, m.body, ...m.tags].join('\n').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
  }

  getModule(id: string): ContentModule {
    const row = this.db
      .prepare('SELECT * FROM content_module WHERE id = ?')
      .get(id) as
      | {
          id: string;
          category: string;
          title: string;
          subtitle: string | null;
          project_type: string | null;
          time_range: string | null;
          body: string;
          tags_json: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;
    if (!row) throw notFound(`Module ${id} not found`);
    return this.rowToModule(row);
  }

  createModule(input: {
    category: ContentModule['category'];
    title: string;
    subtitle?: string;
    projectType?: string;
    timeRange?: string;
    body: string;
    tags?: string[];
  }): ContentModule {
    if (!input.title?.trim()) throw badRequest('title is required');
    if (typeof input.body !== 'string') throw badRequest('body must be a string');
    const ts = nowIso();
    const mod: ContentModule = {
      id: newId(),
      category: input.category,
      title: input.title.trim(),
      subtitle: input.subtitle,
      projectType: input.projectType,
      timeRange: input.timeRange,
      body: input.body,
      tags: normalizeTags(input.tags),
      createdAt: ts,
      updatedAt: ts,
    };
    this.db
      .prepare(
        `INSERT INTO content_module
         (id, category, title, subtitle, project_type, time_range, body, tags_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        mod.id,
        mod.category,
        mod.title,
        mod.subtitle ?? null,
        mod.projectType ?? null,
        mod.timeRange ?? null,
        mod.body,
        JSON.stringify(mod.tags),
        mod.createdAt,
        mod.updatedAt,
      );
    return mod;
  }

  updateModule(
    id: string,
    input: {
      category: ContentModule['category'];
      title: string;
      subtitle?: string;
      projectType?: string;
      timeRange?: string;
      body: string;
      tags?: string[];
    },
  ): ContentModule {
    this.getModule(id);
    if (!input.title?.trim()) throw badRequest('title is required');
    if (typeof input.body !== 'string') throw badRequest('body must be a string');
    const updatedAt = nowIso();
    this.db
      .prepare(
        `UPDATE content_module SET category = ?, title = ?, subtitle = ?, project_type = ?,
         time_range = ?, body = ?, tags_json = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        input.category,
        input.title.trim(),
        input.subtitle ?? null,
        input.projectType ?? null,
        input.timeRange ?? null,
        input.body,
        JSON.stringify(normalizeTags(input.tags)),
        updatedAt,
        id,
      );
    return this.getModule(id);
  }

  deleteModule(id: string): void {
    this.getModule(id);
    this.db.prepare('DELETE FROM content_module WHERE id = ?').run(id);
  }

  listResumes(): Array<
    Pick<ResumeDocument, 'id' | 'title' | 'templateId' | 'profileId' | 'updatedAt'>
  > {
    const rows = this.db
      .prepare(
        'SELECT id, title, template_id, profile_id, updated_at FROM resume ORDER BY updated_at DESC',
      )
      .all() as Array<{
      id: string;
      title: string;
      template_id: string;
      profile_id: string;
      updated_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      templateId: r.template_id as TemplateId,
      profileId: r.profile_id ?? '',
      updatedAt: r.updated_at,
    }));
  }

  createResume(input: {
    title?: string;
    templateId?: string;
    profileId?: string;
  } = {}): ResumeDocument {
    const templateId = input.templateId ?? DEFAULT_TEMPLATE_ID;
    if (!isRegisteredTemplateId(templateId)) {
      throw badRequest(`unknown template: ${templateId}`);
    }
    if (input.profileId) {
      this.getProfileById(input.profileId);
    }
    const id = newId();
    const updatedAt = nowIso();
    const docTitle = input.title?.trim() || '未命名简历';
    this.db
      .prepare(
        `INSERT INTO resume (id, title, template_id, profile_id, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, docTitle, templateId, input.profileId ?? '', updatedAt);
    return this.getResume(id);
  }

  getResume(id: string): ResumeDocument {
    const row = this.db.prepare('SELECT * FROM resume WHERE id = ?').get(id) as
      | {
          id: string;
          title: string;
          template_id: string;
          profile_id: string;
          updated_at: string;
        }
      | undefined;
    if (!row) throw notFound(`Resume ${id} not found`);

    const placementRows = this.db
      .prepare(
        `SELECT id, section, sort_order, snapshot_json FROM section_placement
         WHERE resume_id = ? ORDER BY section, sort_order`,
      )
      .all(id) as Array<{
      id: string;
      section: string;
      sort_order: number;
      snapshot_json: string;
    }>;

    const placements: SectionPlacement[] = placementRows.map((p) => ({
      id: p.id,
      section: p.section as SectionId,
      sortOrder: p.sort_order,
      snapshot: parseJson<ModuleSnapshot>(p.snapshot_json, {
        sourceModuleId: '',
        category: 'project',
        title: '',
        body: '',
        tags: [],
        snapshottedAt: '',
      }),
    }));

    return {
      id: row.id,
      title: row.title,
      templateId: row.template_id as TemplateId,
      profileId: row.profile_id ?? '',
      placements,
      updatedAt: row.updated_at,
    };
  }

  patchResume(
    id: string,
    input: { title?: string; profileId?: string | null; templateId?: string },
  ): ResumeDocument {
    this.getResume(id);
    if (input.title !== undefined) {
      if (!input.title.trim()) throw badRequest('title cannot be empty');
      this.db
        .prepare('UPDATE resume SET title = ?, updated_at = ? WHERE id = ?')
        .run(input.title.trim(), nowIso(), id);
    }
    if (input.templateId !== undefined) {
      if (!isRegisteredTemplateId(input.templateId)) {
        throw badRequest(`unknown template: ${input.templateId}`);
      }
      this.db
        .prepare('UPDATE resume SET template_id = ?, updated_at = ? WHERE id = ?')
        .run(input.templateId, nowIso(), id);
    }
    if (input.profileId !== undefined) {
      const pid = input.profileId ?? '';
      if (pid) this.getProfileById(pid);
      this.db
        .prepare('UPDATE resume SET profile_id = ?, updated_at = ? WHERE id = ?')
        .run(pid, nowIso(), id);
    }
    return this.getResume(id);
  }

  addPlacement(
    resumeId: string,
    section: SectionId,
    snapshot: ModuleSnapshot,
  ): SectionPlacement {
    const resume = this.getResume(resumeId);
    const maxOrder = resume.placements
      .filter((p) => p.section === section)
      .reduce((m, p) => Math.max(m, p.sortOrder), -1);
    const placement: SectionPlacement = {
      id: newId(),
      section,
      sortOrder: maxOrder + 1,
      snapshot,
    };
    this.db
      .prepare(
        `INSERT INTO section_placement (id, resume_id, section, sort_order, snapshot_json)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        placement.id,
        resumeId,
        section,
        placement.sortOrder,
        JSON.stringify(snapshot),
      );
    this.db
      .prepare('UPDATE resume SET updated_at = ? WHERE id = ?')
      .run(nowIso(), resumeId);
    return placement;
  }

  reorderPlacements(
    resumeId: string,
    section: SectionId,
    orderedPlacementIds: string[],
  ): ResumeDocument {
    const resume = this.getResume(resumeId);
    const sectionPlacements = resume.placements.filter(
      (p) => p.section === section,
    );
    const idSet = new Set(sectionPlacements.map((p) => p.id));
    if (
      orderedPlacementIds.length !== idSet.size ||
      orderedPlacementIds.some((id) => !idSet.has(id))
    ) {
      throw badRequest('orderedPlacementIds must match section placements');
    }
    const stmt = this.db.prepare(
      'UPDATE section_placement SET sort_order = ? WHERE id = ? AND resume_id = ?',
    );
    orderedPlacementIds.forEach((pid, index) => {
      stmt.run(index, pid, resumeId);
    });
    this.db
      .prepare('UPDATE resume SET updated_at = ? WHERE id = ?')
      .run(nowIso(), resumeId);
    return this.getResume(resumeId);
  }

  deletePlacement(resumeId: string, placementId: string): void {
    this.getResume(resumeId);
    const result = this.db
      .prepare(
        'DELETE FROM section_placement WHERE id = ? AND resume_id = ?',
      )
      .run(placementId, resumeId);
    if (result.changes === 0) {
      throw notFound(`Placement ${placementId} not found`);
    }
    this.db
      .prepare('UPDATE resume SET updated_at = ? WHERE id = ?')
      .run(nowIso(), resumeId);
  }

  private rowToModule(row: {
    id: string;
    category: string;
    title: string;
    subtitle: string | null;
    project_type: string | null;
    time_range: string | null;
    body: string;
    tags_json: string;
    created_at: string;
    updated_at: string;
  }): ContentModule {
    return {
      id: row.id,
      category: row.category as ContentModule['category'],
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      projectType: row.project_type ?? undefined,
      timeRange: row.time_range ?? undefined,
      body: row.body,
      tags: parseJson<string[]>(row.tags_json, []),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
}

function normalizeEducation(
  items: EducationItem[] | undefined,
): EducationItem[] {
  if (!items?.length) return [];
  return items.map((e) => {
    const startDate = e.startDate?.trim() || undefined;
    const endDate = e.endDate?.trim() || undefined;
    return {
      id: e.id || newId(),
      school: (e.school ?? '').trim(),
      degree: e.degree?.trim() || undefined,
      major: e.major?.trim() || undefined,
      startDate,
      endDate,
      timeRange: educationTimeRange(startDate, endDate, e.timeRange),
      gpa: e.gpa?.trim() || undefined,
      rank: e.rank?.trim() || undefined,
      courses: e.courses?.trim() || undefined,
    };
  });
}

function normalizeSkills(items: SkillBlock[] | undefined): SkillBlock[] {
  if (!items?.length) return [];
  return items
    .map((s) => ({
      id: s.id || newId(),
      title: (s.title ?? '').trim(),
      body: (s.body ?? '').trim(),
    }))
    .filter((s) => s.title || s.body);
}
