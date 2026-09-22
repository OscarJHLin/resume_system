/**
 * Workbench UX copy helpers for empty / error / seed states (S4).
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
      message: '还没有简历。点击「写入演示数据」一键生成可读样例，或稍后再创建。',
    };
  }
  if (input.libraryCount === 0) {
    return {
      tone: 'warn',
      message: '内容库为空。写入演示数据后可从左侧拖模块到右侧区块。',
    };
  }
  if (input.placementCount === 0) {
    return {
      tone: 'info',
      message: '简历区块仍为空：从左侧拖入模块，或重新写入演示数据（会预置条目）。',
    };
  }
  return null;
}

export function statusLine(phase: string, detail: string): string {
  return `${phase} · ${detail}`;
}
