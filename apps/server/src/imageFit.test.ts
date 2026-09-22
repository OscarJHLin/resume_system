import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fitContain, readImageSize } from './modules/export/imageFit.js';

describe('imageFit for DOCX photo', () => {
  it('contains without stretching', () => {
    // Wide image into portrait box
    assert.deepEqual(fitContain(3200, 2400, 98, 131), {
      width: 98,
      height: 74,
    });
    // Tall image
    assert.deepEqual(fitContain(800, 1200, 98, 131), {
      width: 87,
      height: 131,
    });
  });

  it('reads PNG size', () => {
    // Minimal 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    assert.deepEqual(readImageSize(png), { width: 1, height: 1 });
  });
});
