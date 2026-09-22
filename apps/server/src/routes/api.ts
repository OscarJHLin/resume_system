import type { FastifyInstance } from 'fastify';
import {
  categoryAllowedInSection,
  DEFAULT_TEMPLATE_ID,
  isCategory,
  isPlaceableSection,
  isSectionId,
  snapshotFromModule,
  validateProfileRequired,
} from '@resume/domain';
import type { Store } from '../db/store.js';
import { HttpError, badRequest } from '../errors.js';
import {
  placeholderProfile,
  renderToIR,
} from '../modules/template/index.js';
import { listTemplateMeta, isRegisteredTemplateId } from '../modules/template/registry.js';
import { exportDocx } from '../modules/export/index.js';

type ProfileBody = {
  name: string;
  gender: string;
  phone: string;
  email: string;
  wechat: string;
  qq?: string;
  location?: string;
  summary?: string;
  education?: Array<{
    id?: string;
    school: string;
    degree?: string;
    major?: string;
    startDate?: string;
    endDate?: string;
    timeRange?: string;
    gpa?: string;
    rank?: string;
    courses?: string;
  }>;
  skills?: Array<{ id?: string; title: string; body: string }>;
  tags?: string[];
  notes?: string;
};

function mapProfileBody(body: ProfileBody) {
  const checked = validateProfileRequired(body);
  if (!checked.ok) throw badRequest(checked.error);
  return {
    name: body.name,
    gender: body.gender,
    phone: body.phone,
    email: body.email,
    wechat: body.wechat,
    qq: body.qq,
    location: body.location,
    summary: body.summary,
    education: body.education?.map((e) => ({
      id: e.id ?? '',
      school: e.school,
      degree: e.degree,
      major: e.major,
      startDate: e.startDate,
      endDate: e.endDate,
      timeRange: e.timeRange,
      gpa: e.gpa,
      rank: e.rank,
      courses: e.courses,
    })),
    skills: body.skills?.map((s) => ({
      id: s.id ?? '',
      title: s.title,
      body: s.body ?? '',
    })),
    tags: body.tags,
    notes: body.notes,
  };
}

export async function registerApiRoutes(app: FastifyInstance, store: Store) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply
        .code(err.statusCode)
        .send({ error: err.code, message: err.message });
    }
    const code = (err as { code?: string }).code;
    if (code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send({
        error: 'PayloadTooLarge',
        message: '上传内容过大（照片请小于 5MB）',
      });
    }
    app.log.error(err);
    return reply
      .code(500)
      .send({ error: 'InternalError', message: 'Unexpected server error' });
  });

  const templates = listTemplateMeta();

  app.get('/api/meta', async () => ({
    templateId: DEFAULT_TEMPLATE_ID,
    templates,
    phase: 'S5',
    modules: [
      'profile-cards',
      'content-library',
      'resume-assembly',
      'template-engine',
      'export-docx',
    ],
    status: 'ready',
  }));

  app.get('/api/templates', async () => listTemplateMeta());

  // —— Profile cards (基本信息) ——
  app.get<{
    Querystring: { q?: string; tag?: string };
  }>('/api/profiles', async (req) =>
    store.listProfiles({ q: req.query.q, tag: req.query.tag }),
  );

  app.post<{ Body: ProfileBody }>('/api/profiles', async (req, reply) => {
    if (!req.body || typeof req.body !== 'object') {
      throw badRequest('JSON body required');
    }
    const created = store.createProfile(mapProfileBody(req.body));
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/api/profiles/:id', async (req) =>
    store.getProfileById(req.params.id),
  );

  app.put<{ Params: { id: string }; Body: ProfileBody }>(
    '/api/profiles/:id',
    async (req) => {
      if (!req.body || typeof req.body !== 'object') {
        throw badRequest('JSON body required');
      }
      return store.updateProfile(req.params.id, mapProfileBody(req.body));
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/profiles/:id',
    async (req, reply) => {
      store.deleteProfile(req.params.id);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>(
    '/api/profiles/:id/photo',
    async (req, reply) => {
      const photo = store.getProfilePhoto(req.params.id);
      if (!photo) {
        return reply.code(404).send({ error: 'NotFound', message: 'No photo' });
      }
      return reply
        .type(photo.mime)
        .header('cache-control', 'no-cache')
        .send(photo.buffer);
    },
  );

  app.put<{
    Params: { id: string };
    Body: { dataBase64: string; mime?: string };
  }>('/api/profiles/:id/photo', async (req) => {
    const body = req.body;
    if (!body?.dataBase64) throw badRequest('dataBase64 required');
    const mime = body.mime ?? 'image/jpeg';
    const ext =
      mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const raw = body.dataBase64.replace(/^data:[^;]+;base64,/, '');
    const bytes = Buffer.from(raw, 'base64');
    if (bytes.length === 0) throw badRequest('empty photo');
    if (bytes.length > 5 * 1024 * 1024) {
      throw badRequest('photo too large (max 5MB)');
    }
    return store.saveProfilePhoto(req.params.id, bytes, ext);
  });

  app.delete<{ Params: { id: string } }>(
    '/api/profiles/:id/photo',
    async (req) => store.clearProfilePhoto(req.params.id),
  );

  // —— Content modules ——
  app.get<{
    Querystring: { category?: string; tag?: string; q?: string };
  }>('/api/modules', async (req) => {
    const { category, tag, q } = req.query;
    if (category && !isCategory(category)) {
      throw badRequest(`invalid category: ${category}`);
    }
    return store.listModules({ category, tag, q });
  });

  app.get<{ Params: { id: string } }>('/api/modules/:id', async (req) =>
    store.getModule(req.params.id),
  );

  app.post<{
    Body: {
      category: string;
      title: string;
      subtitle?: string;
      projectType?: string;
      timeRange?: string;
      body: string;
      tags?: string[];
    };
  }>('/api/modules', async (req, reply) => {
    const body = req.body;
    if (!body || !isCategory(body.category)) {
      throw badRequest('valid category is required');
    }
    const created = store.createModule({
      category: body.category,
      title: body.title,
      subtitle: body.subtitle,
      projectType: body.projectType,
      timeRange: body.timeRange,
      body: body.body ?? '',
      tags: body.tags,
    });
    return reply.code(201).send(created);
  });

  app.put<{
    Params: { id: string };
    Body: {
      category: string;
      title: string;
      subtitle?: string;
      projectType?: string;
      timeRange?: string;
      body: string;
      tags?: string[];
    };
  }>('/api/modules/:id', async (req) => {
    const body = req.body;
    if (!body || !isCategory(body.category)) {
      throw badRequest('valid category is required');
    }
    return store.updateModule(req.params.id, {
      category: body.category,
      title: body.title,
      subtitle: body.subtitle,
      projectType: body.projectType,
      timeRange: body.timeRange,
      body: body.body ?? '',
      tags: body.tags,
    });
  });

  app.delete<{ Params: { id: string } }>('/api/modules/:id', async (req, reply) => {
    store.deleteModule(req.params.id);
    return reply.code(204).send();
  });

  // —— Resumes ——
  app.get('/api/resumes', async () => store.listResumes());

  app.post<{
    Body: { title?: string; templateId?: string; profileId?: string };
  }>('/api/resumes', async (req, reply) => {
    const body = req.body ?? {};
    if (body.templateId && !isRegisteredTemplateId(body.templateId)) {
      throw badRequest(`unknown template: ${body.templateId}`);
    }
    const created = store.createResume({
      title: body.title,
      templateId: body.templateId,
      profileId: body.profileId,
    });
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/api/resumes/:id', async (req) =>
    store.getResume(req.params.id),
  );

  app.patch<{
    Params: { id: string };
    Body: { title?: string; profileId?: string | null; templateId?: string };
  }>('/api/resumes/:id', async (req) =>
    store.patchResume(req.params.id, {
      title: req.body?.title,
      profileId: req.body?.profileId,
      templateId: req.body?.templateId,
    }),
  );

  app.post<{
    Params: { id: string };
    Body: { section: string; moduleId: string };
  }>('/api/resumes/:id/placements', async (req, reply) => {
    const { section, moduleId } = req.body ?? {};
    if (!section || !isSectionId(section)) {
      throw badRequest('valid section is required');
    }
    if (!isPlaceableSection(section)) {
      throw badRequest(`section ${section} does not accept placements`);
    }
    if (!moduleId) throw badRequest('moduleId is required');

    const mod = store.getModule(moduleId);
    if (!categoryAllowedInSection(mod.category, section)) {
      throw badRequest(
        `category ${mod.category} cannot be placed in section ${section}`,
      );
    }

    const snapshot = snapshotFromModule(mod);
    const placement = store.addPlacement(req.params.id, section, snapshot);
    return reply.code(201).send(placement);
  });

  app.patch<{
    Params: { id: string };
    Body: { section: string; orderedPlacementIds: string[] };
  }>('/api/resumes/:id/placements/reorder', async (req) => {
    const { section, orderedPlacementIds } = req.body ?? {};
    if (!section || !isSectionId(section)) {
      throw badRequest('valid section is required');
    }
    if (!Array.isArray(orderedPlacementIds)) {
      throw badRequest('orderedPlacementIds must be an array');
    }
    return store.reorderPlacements(
      req.params.id,
      section,
      orderedPlacementIds,
    );
  });

  app.delete<{
    Params: { id: string; placementId: string };
  }>('/api/resumes/:id/placements/:placementId', async (req, reply) => {
    store.deletePlacement(req.params.id, req.params.placementId);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>(
    '/api/resumes/:id/export',
    async (req, reply) => {
      const resume = store.getResume(req.params.id);
      const profile = resume.profileId
        ? store.getProfileById(resume.profileId)
        : placeholderProfile();
      const ir = renderToIR({
        templateId: resume.templateId,
        profile,
        placements: resume.placements,
      });
      // Photo intentionally omitted from DOCX (template has no photo column).
      const buffer = await exportDocx(ir, { photo: null });
      const filename = `${sanitizeFilename(resume.title)}.docx`;
      const encoded = encodeURIComponent(filename);
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        .header(
          'Content-Disposition',
          `attachment; filename="resume.docx"; filename*=UTF-8''${encoded}`,
        )
        .send(buffer);
    },
  );
}

function sanitizeFilename(title: string): string {
  const cleaned = title.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 80);
  return cleaned || 'resume';
}
