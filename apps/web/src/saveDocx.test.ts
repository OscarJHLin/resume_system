import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isTauriShell,
  normalizeDocxName,
  resolveTauriInvoke,
} from './features/workbench/saveDocx.js';

describe('saveDocx filename', () => {
  it('ensures .docx and strips path chars', () => {
    assert.equal(normalizeDocxName('我的简历'), '我的简历.docx');
    assert.equal(normalizeDocxName('a/b:c.docx'), 'a_b_c.docx');
    assert.equal(normalizeDocxName('  '), 'resume.docx');
  });
});

describe('saveDocx Tauri detection', () => {
  it('detects shell via internals or global invoke', () => {
    assert.equal(isTauriShell({} as Window), false);
    assert.equal(
      isTauriShell({
        __TAURI_INTERNALS__: { invoke: async () => null },
      } as unknown as Window),
      true,
    );
    assert.equal(
      isTauriShell({
        __TAURI__: { core: { invoke: async () => null } },
      } as unknown as Window),
      true,
    );
  });

  it('prefers __TAURI_INTERNALS__.invoke for remote pages', async () => {
    const calls: unknown[] = [];
    const internalsInvoke = async (cmd: string, args?: Record<string, unknown>) => {
      calls.push({ via: 'internals', cmd, args });
      return 'ok.docx';
    };
    const globalInvoke = async (cmd: string, args?: Record<string, unknown>) => {
      calls.push({ via: 'global', cmd, args });
      return 'bad.docx';
    };
    const invoke = resolveTauriInvoke({
      __TAURI_INTERNALS__: { invoke: internalsInvoke },
      __TAURI__: { core: { invoke: globalInvoke } },
    } as unknown as Window);
    assert.ok(invoke);
    const result = await invoke!('save_docx', {
      suggestedName: 'x.docx',
      dataBase64: 'YQ==',
    });
    assert.equal(result, 'ok.docx');
    assert.equal((calls[0] as { via: string }).via, 'internals');
  });

  it('falls back to __TAURI__.core.invoke', async () => {
    const invoke = resolveTauriInvoke({
      __TAURI__: {
        core: {
          invoke: async () => 'from-global.docx',
        },
      },
    } as unknown as Window);
    assert.equal(await invoke!('save_docx', {}), 'from-global.docx');
  });
});
