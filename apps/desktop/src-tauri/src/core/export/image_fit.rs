//! Image fit helpers — mirrors `apps/server/src/modules/export/imageFit.ts`.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Size {
  pub width: u32,
  pub height: u32,
}

/// Fit image into a max box without stretching (letterbox / contain).
pub fn fit_contain(src_w: u32, src_h: u32, max_w: u32, max_h: u32) -> Size {
  if src_w == 0 || src_h == 0 {
    return Size {
      width: max_w,
      height: max_h,
    };
  }
  let scale = (max_w as f64 / src_w as f64).min(max_h as f64 / src_h as f64);
  Size {
    width: ((src_w as f64 * scale).round() as u32).max(1),
    height: ((src_h as f64 * scale).round() as u32).max(1),
  }
}

/// Read PNG/JPEG/WEBP pixel size from buffer (no deps). Returns None if unknown.
pub fn read_image_size(buffer: &[u8]) -> Option<(u32, u32)> {
  if buffer.len() < 24 {
    return None;
  }
  // PNG
  if buffer[0] == 0x89 && buffer[1] == 0x50 && buffer[2] == 0x4e && buffer[3] == 0x47 {
    let width = u32::from_be_bytes([buffer[16], buffer[17], buffer[18], buffer[19]]);
    let height = u32::from_be_bytes([buffer[20], buffer[21], buffer[22], buffer[23]]);
    if width > 0 && height > 0 {
      return Some((width, height));
    }
    return None;
  }
  // JPEG
  if buffer[0] == 0xff && buffer[1] == 0xd8 {
    let mut i = 2usize;
    while i + 8 < buffer.len() {
      if buffer[i] != 0xff {
        i += 1;
        continue;
      }
      let marker = buffer[i + 1];
      if marker == 0xd9 || marker == 0xda {
        break;
      }
      if i + 3 >= buffer.len() {
        break;
      }
      let len = u16::from_be_bytes([buffer[i + 2], buffer[i + 3]]) as usize;
      if marker == 0xc0 || marker == 0xc2 || marker == 0xc1 || marker == 0xc3 {
        if i + 8 >= buffer.len() {
          break;
        }
        let height = u16::from_be_bytes([buffer[i + 5], buffer[i + 6]]) as u32;
        let width = u16::from_be_bytes([buffer[i + 7], buffer[i + 8]]) as u32;
        if width > 0 && height > 0 {
          return Some((width, height));
        }
        return None;
      }
      i += 2 + len;
    }
  }
  // WEBP VP8X / VP8
  if buffer.len() >= 30 && &buffer[0..4] == b"RIFF" && &buffer[8..12] == b"WEBP" {
    let chunk = &buffer[12..16];
    if chunk == b"VP8X" {
      let width = 1
        + ((buffer[24] as u32) | ((buffer[25] as u32) << 8) | ((buffer[26] as u32) << 16));
      let height = 1
        + ((buffer[27] as u32) | ((buffer[28] as u32) << 8) | ((buffer[29] as u32) << 16));
      if width > 0 && height > 0 {
        return Some((width, height));
      }
    }
    if chunk == b"VP8 " {
      let width = (u16::from_le_bytes([buffer[26], buffer[27]]) & 0x3fff) as u32;
      let height = (u16::from_le_bytes([buffer[28], buffer[29]]) & 0x3fff) as u32;
      if width > 0 && height > 0 {
        return Some((width, height));
      }
    }
  }
  None
}
