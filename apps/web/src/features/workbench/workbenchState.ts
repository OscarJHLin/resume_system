/**
 * Workbench UX copy helpers for empty / error states.
 */

export type ConnectionState = 'loading' | 'ok' | 'error';

export function workbenchBanner(input: {
  connection: ConnectionState;
  hasResume: boolean;
  placementCount: number;
  libraryCount: number | null;
}): { tone: 'info' | 'warn' | 'error' | 'ok'; message: string } | null {
  if (input.connection === 'loading') {
    return { tone: 'info', message: '正在连接 API…' };
  }
  if (input.connection === 'error') {
    return {
      tone: 'error',
      message: '无法连接 API。请先运行 npm run dev:server，再刷新本页。',
    };
  }
  if (!input.hasResume) {
    return {
      tone: 'warn',
      message:
        '还没有简历。点击顶部「选择简历模板」初始化左侧空白模板，再在右侧维护内容。',
    };
  }
  if (input.libraryCount === 0) {
    return {
      tone: 'warn',
      message:
        '内容库为空。在右侧标签下点 + 新建项目 / 实习 / 获奖或基本信息卡。',
    };
  }
  if (input.placementCount === 0) {
    return {
      tone: 'info',
      message:
        '经历区块仍为空：从右侧拖入项目 / 实习 / 获奖；基本信息点「应用到简历」。',
    };
  }
  return null;
}

export function statusLine(phase: string, detail: string): string {
  return `${phase} · ${detail}`;
}
