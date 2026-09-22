import type { FastifyInstance } from 'fastify';
import {
  categoryAllowedInSection,
  DEFAULT_TEMPLATE_ID,
  isCategory,
  isPlaceableSection,
  isSectionId,
  snapshotFromModule,
} from '@resume/domain';
import type { Store } from '../db/store.js';
import { HttpError, badRequest } from '../errors.js';
import { renderToIR } from '../modules/template/index.js';
import { exportDocx } from '../modules/export/index.js';

export async function registerApiRoutes(app: FastifyInstance, store: Store) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply
        .code(err.statusCode)
        .send({ error: err.code, message: err.message });
    }
    app.log.error(err);
    return reply
      .code(500)
      .send({ error: 'InternalError', message: 'Unexpected server error' });
  });

  app.get('/api/meta', async () => ({
    templateId: DEFAULT_TEMPLATE_ID,
    phase: 'S1',
    modules: [
      'profile',
      'content-library',
      'resume-assembly',
      'template-engine',
      'export-docx',
    ],
    status: 'ready',
  }));

  // —— Profile ——
  app.get('/api/profile', async () => store.ensureDefaultProfile());

  app.put<{
    Body: {
      name: string;
      phone?: string;
      email?: string;
      location?: string;
      summary?: string;
      education?: Array<{
        id?: string;
        school: string;
        degree?: string;
        major?: string;
        timeRange?: string;
      }>;
    };
  }>('/api/profile', async (req) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      throw badRequest('JSON body required');
    }
    return store.updateProfile({
      name: body.name,
      phone: body.phone,
      email: body.email,
      location: body.location,
      summary: body.summary,
      education: body.education?.map((e) => ({
        id: e.id ?? '',
        school: e.school,
        degree: e.degree,
        major: e.major,
        timeRange: e.timeRange,
      })),
    });
  });

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

  app.post<{ Body: { title?: string } }>('/api/resumes', async (req, reply) => {
    const created = store.createResume(req.body?.title);
    return reply.code(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/api/resumes/:id', async (req) =>
    store.getResume(req.params.id),
  );

  app.patch<{
    Params: { id: string };
    Body: { title?: string };
  }>('/api/resumes/:id', async (req) =>
    store.patchResume(req.params.id, { title: req.body?.title }),
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
      const profile = store.getProfile();
      const ir = renderToIR({
        templateId: DEFAULT_TEMPLATE_ID,
        profile,
        placements: resume.placements,
      });
      const buffer = await exportDocx(ir);
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
