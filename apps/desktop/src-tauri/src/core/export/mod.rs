//! ResumeIR → DOCX via `docx-rs` (Plan C Phase 3 — pure Rust, option A).

use std::io::Cursor;
use std::path::Path;

use docx_rs::{
  AlignmentType, BorderType, Docx, LineSpacing, LineSpacingType, PageMargin, Paragraph,
  ParagraphBorder, ParagraphBorderPosition, ParagraphBorders, Pic, Run, RunFonts,
  SpecialIndentType, Tab, TabValueType,
};

use crate::core::error::ApiError;
use crate::core::render::{EntryTabs, IrBlock, IrRun, ResumeIR};
use crate::core::templates::{get_template, TemplateDefinition, DEFAULT_TEMPLATE_ID};

mod image_fit;

use image_fit::{fit_contain, read_image_size};

const ENTRY_TAB_CENTER: i64 = 4933;
const ENTRY_TAB_RIGHT: i64 = 9866;
const EMU_PER_PX: u32 = 9525;

pub struct ExportPhoto {
  pub buffer: Vec<u8>,
  pub mime: String,
}

pub fn export_docx(
  templates_dir: &Path,
  ir: &ResumeIR,
  photo: Option<&ExportPhoto>,
) -> Result<Vec<u8>, ApiError> {
  let def = get_template(templates_dir, &ir.template_id)
    .or_else(|| get_template(templates_dir, DEFAULT_TEMPLATE_ID));
  let page = def.as_ref().map(|d| &d.page);
  let (width, height, margin) = match page {
    Some(p) => (
      p.width,
      p.height,
      PageMargin::new()
        .top(p.margin.top)
        .right(p.margin.right)
        .bottom(p.margin.bottom)
        .left(p.margin.left),
    ),
    None => (
      11906,
      16838,
      PageMargin::new()
        .top(680)
        .right(1020)
        .bottom(680)
        .left(1020),
    ),
  };

  let layout = def.as_ref().map(|d| &d.layout);
  let photo_spec = def.as_ref().and_then(|d| d.photo.as_ref());
  let max_w = photo_spec.map(|p| p.width_px).unwrap_or(98);
  let max_h = photo_spec.map(|p| p.height_px).unwrap_or(131);

  let mut docx = Docx::new()
    .page_size(width, height)
    .page_margin(margin);

  if let Some(photo) = photo {
    if !photo.buffer.is_empty() {
      if let Some(para) = photo_paragraph(&photo.buffer, max_w, max_h) {
        docx = docx.add_paragraph(para);
      }
    }
  }

  let mut any = false;
  for block in &ir.blocks {
    docx = docx.add_paragraph(block_to_paragraph(block, layout));
    any = true;
  }
  if !any {
    docx = docx.add_paragraph(Paragraph::new().add_run(Run::new().add_text("")));
  }

  let mut buf = Cursor::new(Vec::new());
  docx
    .pack(&mut buf)
    .map_err(|e| ApiError::Internal(format!("docx pack: {e}")))?;
  Ok(buf.into_inner())
}

fn photo_paragraph(buffer: &[u8], max_w: u32, max_h: u32) -> Option<Paragraph> {
  let native = read_image_size(buffer);
  let (fit_w, fit_h) = match native {
    Some((w, h)) => {
      let f = fit_contain(w, h, max_w, max_h);
      (f.width, f.height)
    }
    None => (max_w, max_h),
  };
  let (nat_w, nat_h) = native.unwrap_or((fit_w, fit_h));
  // Prefer lossless path for PNG; otherwise let docx-rs convert via Pic::new.
  let pic = if buffer.starts_with(&[0x89, 0x50, 0x4e, 0x47]) {
    Pic::new_with_dimensions(buffer.to_vec(), nat_w.max(1), nat_h.max(1))
      .size(fit_w.max(1) * EMU_PER_PX, fit_h.max(1) * EMU_PER_PX)
  } else {
    // Pic::new may panic on corrupt bytes — only call when size was readable
    // or buffer looks like JPEG/WEBP.
    if native.is_none()
      && !(buffer.starts_with(&[0xff, 0xd8])
        || (buffer.len() >= 12 && &buffer[0..4] == b"RIFF" && &buffer[8..12] == b"WEBP"))
    {
      return None;
    }
    Pic::new(buffer).size(fit_w.max(1) * EMU_PER_PX, fit_h.max(1) * EMU_PER_PX)
  };
  Some(
    Paragraph::new()
      .align(AlignmentType::Center)
      .line_spacing(
        LineSpacing::new()
          .after(120)
          .line(276)
          .line_rule(LineSpacingType::Auto),
      )
      .add_run(Run::new().add_image(pic)),
  )
}

fn block_to_paragraph(
  block: &IrBlock,
  layout: Option<&crate::core::templates::TemplateLayoutSpec>,
) -> Paragraph {
  match block {
    IrBlock::Heading {
      level,
      runs,
      alignment,
      spacing_before_pt,
      spacing_after_pt,
      border_bottom,
    } => {
      let before = pt_to_twip(spacing_before_pt.unwrap_or(if *level == 1 { 0.0 } else { 10.0 }));
      let after = pt_to_twip(spacing_after_pt.unwrap_or(6.0));
      let line = if *level == 1 { 560 } else { 360 };
      let mut p = Paragraph::new().line_spacing(
        LineSpacing::new()
          .before(before)
          .after(after)
          .line(line)
          .line_rule(LineSpacingType::Auto),
      );
      if let Some(a) = map_align(alignment.as_deref()) {
        p = p.align(a);
      }
      if border_bottom.unwrap_or(false) {
        p = p.set_borders(
          ParagraphBorders::with_empty().set(
            ParagraphBorder::new(ParagraphBorderPosition::Bottom)
              .val(BorderType::Single)
              .size(6)
              .color("000000")
              .space(4),
          ),
        );
      }
      for run in runs {
        p = p.add_run(run_to_text_run(run));
      }
      p
    }
    IrBlock::Paragraph {
      runs,
      spacing_after_pt,
      spacing_before_pt,
      alignment,
      bullet,
      entry_tabs,
    } => {
      let tab_right = layout.map(|l| l.entry_tab_right).unwrap_or(ENTRY_TAB_RIGHT);
      let default_center = layout
        .map(|l| l.entry_tab_center)
        .unwrap_or(ENTRY_TAB_CENTER);
      let center_pos = match entry_tabs {
        Some(EntryTabs::Center(n)) => *n,
        Some(EntryTabs::Flag(true)) => default_center,
        _ => default_center,
      };
      let bullet_left = layout.map(|l| l.bullet_indent.left).unwrap_or(340);
      let bullet_hang = layout.map(|l| l.bullet_indent.hanging).unwrap_or(228);
      let is_bullet = bullet.unwrap_or(false);
      let line = if is_bullet {
        320
      } else if alignment.as_deref() == Some("center") {
        280
      } else {
        320
      };
      let mut p = Paragraph::new().line_spacing(
        LineSpacing::new()
          .before(pt_to_twip(spacing_before_pt.unwrap_or(0.0)))
          .after(pt_to_twip(spacing_after_pt.unwrap_or(0.8)))
          .line(line)
          .line_rule(LineSpacingType::Auto),
      );
      if let Some(a) = map_align(alignment.as_deref()) {
        p = p.align(a);
      }
      if is_bullet {
        p = p.indent(
          Some(bullet_left as i32),
          Some(SpecialIndentType::Hanging(bullet_hang as i32)),
          None,
          None,
        );
      }
      if entry_tabs.is_some() {
        p = p
          .add_tab(
            Tab::new()
              .val(TabValueType::Center)
              .pos(center_pos as usize),
          )
          .add_tab(
            Tab::new()
              .val(TabValueType::Right)
              .pos(tab_right as usize),
          );
      }
      if is_bullet {
        p = p.add_run(
          Run::new()
            .add_text("• ")
            .bold()
            .fonts(font_face("宋体"))
            .size(21),
        );
      }
      for run in runs {
        p = p.add_run(run_to_text_run(run));
      }
      p
    }
  }
}

fn run_to_text_run(run: &IrRun) -> Run {
  if run.text == "\t" {
    let mut r = Run::new().add_tab();
    r = apply_style(r, run);
    return r;
  }
  let mut r = Run::new().add_text(&run.text);
  r = apply_style(r, run);
  r
}

fn apply_style(mut r: Run, run: &IrRun) -> Run {
  let east = run
    .style
    .as_ref()
    .and_then(|s| s.font_east_asia.as_deref())
    .unwrap_or("宋体");
  r = r.fonts(font_face(east));
  let size_pt = run
    .style
    .as_ref()
    .and_then(|s| s.font_size_pt)
    .unwrap_or(10.5);
  r = r.size(((size_pt * 2.0).round() as usize).max(1));
  if run.style.as_ref().and_then(|s| s.bold).unwrap_or(false) {
    r = r.bold();
  }
  if run.style.as_ref().and_then(|s| s.italic).unwrap_or(false) {
    r = r.italic();
  }
  r
}

fn font_face(east_asia: &str) -> RunFonts {
  let face = if east_asia.trim().is_empty() {
    "宋体"
  } else {
    east_asia.trim()
  };
  RunFonts::new()
    .ascii(face)
    .hi_ansi(face)
    .east_asia(face)
    .cs(face)
}

fn map_align(alignment: Option<&str>) -> Option<AlignmentType> {
  match alignment {
    Some("center") => Some(AlignmentType::Center),
    Some("right") => Some(AlignmentType::Right),
    Some("left") => Some(AlignmentType::Left),
    _ => None,
  }
}

fn pt_to_twip(pt: f64) -> u32 {
  (pt * 20.0).round().max(0.0) as u32
}

pub fn sanitize_filename(title: &str) -> String {
  let cleaned: String = title
    .chars()
    .map(|c| {
      if c.is_ascii_alphanumeric() || c == '_' || c == '-' || ('\u{4e00}'..='\u{9fff}').contains(&c)
      {
        c
      } else {
        '_'
      }
    })
    .collect();
  let cleaned = cleaned.chars().take(80).collect::<String>();
  if cleaned.is_empty() {
    "resume".into()
  } else {
    cleaned
  }
}

/// Resolve page geometry for tests.
pub fn page_for_template(templates_dir: &Path, template_id: &str) -> (u32, u32) {
  get_template(templates_dir, template_id)
    .or_else(|| get_template(templates_dir, DEFAULT_TEMPLATE_ID))
    .map(|d: TemplateDefinition| (d.page.width, d.page.height))
    .unwrap_or((11906, 16838))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::core::models::{Profile, SectionPlacement};
  use crate::core::render::render_to_ir;
  use crate::core::templates::reset_template_registry_cache;
  use std::path::PathBuf;

  #[test]
  fn fit_contain_letterboxes() {
    let f = fit_contain(200, 300, 98, 131);
    assert!(f.width <= 98 && f.height <= 131);
    assert_eq!(f.width, 87); // 200*(131/300)≈87
    assert_eq!(f.height, 131);
  }

  #[test]
  fn export_smoke_ooxml_zip() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../templates");
    if !root.is_dir() {
      return;
    }
    reset_template_registry_cache();
    let profile = Profile {
      id: "p".into(),
      name: "导出测".into(),
      gender: "女".into(),
      phone: Some("1".into()),
      email: Some("e@e.com".into()),
      wechat: Some("w".into()),
      qq: None,
      location: None,
      summary: None,
      statement: None,
      education: serde_json::json!([]),
      skills: serde_json::json!([]),
      tags: serde_json::json!([]),
      notes: None,
      has_photo: false,
      created_at: "".into(),
      updated_at: "".into(),
    };
    let placements = vec![SectionPlacement {
      id: "pl".into(),
      section: "projects".into(),
      sort_order: 0,
      snapshot: serde_json::json!({
        "title": "Demo",
        "projectType": "TS",
        "subtitle": "开发",
        "timeRange": "2025",
        "body": "line1"
      }),
    }];
    let ir = render_to_ir(&root, DEFAULT_TEMPLATE_ID, &profile, &placements, || {
      "t".into()
    })
    .unwrap();
    let bytes = export_docx(&root, &ir, None).unwrap();
    assert!(bytes.len() > 100);
    assert_eq!(&bytes[0..2], b"PK");

    // 1x1 PNG photo embeds under word/media
    use base64::Engine as _;
    let png = base64::engine::general_purpose::STANDARD
      .decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      )
      .unwrap();
    let with_photo = export_docx(
      &root,
      &ir,
      Some(&ExportPhoto {
        buffer: png,
        mime: "image/png".into(),
      }),
    )
    .unwrap();
    assert!(with_photo.len() > bytes.len());
    // crude media presence: png signature somewhere in zip
    assert!(with_photo.windows(4).any(|w| w == [0x89, 0x50, 0x4e, 0x47]));
  }
}
