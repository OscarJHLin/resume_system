import type {
  Category,
  ContentModule,
  EducationItem,
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
  SkillBlock,
  TemplateId,
  TemplateMeta,
} from '@resume/domain';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!res.ok) {
    let message = text || res.statusText;
    try {
      const body = JSON.parse(text) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep raw */
    }
    throw new ApiError(res.status, message);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function buildModulesQuery(filters: {
  category?: string;
  tag?: string;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.q) params.set('q', filters.q);
  const qs = params.toString();
  return qs ? `/api/modules?${qs}` : '/api/modules';
}

export type ProfilePayload = {
  name: string;
  gender: string;
  phone: string;
  email: string;
  wechat: string;
  qq?: string;
  location?: string;
  summary?: string;
  education?: EducationItem[];
  skills?: SkillBlock[];
  tags?: string[];
  notes?: string;
};

export const api = {
  listTemplates: () => request<TemplateMeta[]>('/api/templates'),

  listProfiles: (filters: { q?: string; tag?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.tag) params.set('tag', filters.tag);
    const qs = params.toString();
    return request<Profile[]>(qs ? `/api/profiles?${qs}` : '/api/profiles');
  },

  getProfile: (id: string) => request<Profile>(`/api/profiles/${id}`),

  createProfile: (body: ProfilePayload) =>
    request<Profile>('/api/profiles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  updateProfile: (id: string, body: ProfilePayload) =>
    request<Profile>(`/api/profiles/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  deleteProfile: (id: string) =>
    request<void>(`/api/profiles/${id}`, { method: 'DELETE' }),

  uploadProfilePhoto: (id: string, dataBase64: string, mime: string) =>
    request<Profile>(`/api/profiles/${id}/photo`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dataBase64, mime }),
    }),

  clearProfilePhoto: (id: string) =>
    request<Profile>(`/api/profiles/${id}/photo`, { method: 'DELETE' }),

  profilePhotoUrl: (id: string, updatedAt?: string) =>
    `/api/profiles/${id}/photo${updatedAt ? `?t=${encodeURIComponent(updatedAt)}` : ''}`,

  listModules: (filters: { category?: string; tag?: string; q?: string } = {}) =>
    request<ContentModule[]>(buildModulesQuery(filters)),

  createModule: (body: {
    category: Category;
    title: string;
    subtitle?: string;
    projectType?: string;
    timeRange?: string;
    body: string;
    tags?: string[];
  }) =>
    request<ContentModule>('/api/modules', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  updateModule: (
    id: string,
    body: {
      category: Category;
      title: string;
      subtitle?: string;
      projectType?: string;
      timeRange?: string;
      body: string;
      tags?: string[];
    },
  ) =>
    request<ContentModule>(`/api/modules/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  getModule: (id: string) => request<ContentModule>(`/api/modules/${id}`),

  listResumes: () =>
    request<
      Array<{
        id: string;
        title: string;
        templateId: string;
        profileId: string;
        updatedAt: string;
      }>
    >('/api/resumes'),

  createResume: (body?: {
    title?: string;
    templateId?: TemplateId | string;
    profileId?: string;
  }) =>
    request<ResumeDocument>('/api/resumes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }),

  getResume: (id: string) => request<ResumeDocument>(`/api/resumes/${id}`),

  patchResume: (
    id: string,
    body: { title?: string; profileId?: string | null; templateId?: string },
  ) =>
    request<ResumeDocument>(`/api/resumes/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

  addPlacement: (resumeId: string, section: SectionId, moduleId: string) =>
    request<SectionPlacement>(`/api/resumes/${resumeId}/placements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section, moduleId }),
    }),

  deletePlacement: (resumeId: string, placementId: string) =>
    request<void>(`/api/resumes/${resumeId}/placements/${placementId}`, {
      method: 'DELETE',
    }),

  reorderPlacements: (
    resumeId: string,
    section: SectionId,
    orderedPlacementIds: string[],
  ) =>
    request<ResumeDocument>(`/api/resumes/${resumeId}/placements/reorder`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section, orderedPlacementIds }),
    }),

  exportDocx: async (resumeId: string): Promise<Blob> => {
    const res = await fetch(`/api/resumes/${resumeId}/export`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text());
    }
    return res.blob();
  },
};
