import type {
  Category,
  ContentModule,
  Profile,
  ResumeDocument,
  SectionId,
  SectionPlacement,
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

export const api = {
  getProfile: () => request<Profile>('/api/profile'),

  putProfile: (body: Partial<Profile> & { name: string }) =>
    request<Profile>('/api/profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),

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

  createResume: (title?: string) =>
    request<ResumeDocument>('/api/resumes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    }),

  getResume: (id: string) => request<ResumeDocument>(`/api/resumes/${id}`),

  addPlacement: (resumeId: string, section: SectionId, moduleId: string) =>
    request<SectionPlacement>(`/api/resumes/${resumeId}/placements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section, moduleId }),
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
