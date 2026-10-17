//! Template pack registry — mirrors `apps/server` template/registry.ts.

use std::fs;
use std::path::Path;
use std::sync::Mutex;

use serde::Deserialize;

use crate::core::models::TemplateMeta;

pub const DEFAULT_TEMPLATE_ID: &str = "default-v1";

const DEFAULT_ENTRY_TAB_CENTER: i64 = 4933;
const DEFAULT_INTERNSHIP_TAB_CENTER: i64 = 6520;
const DEFAULT_ENTRY_TAB_RIGHT: i64 = 9866;
const DEFAULT_BULLET_LEFT: i64 = 340;
const DEFAULT_BULLET_HANGING: i64 = 228;

#[derive(Debug, Clone)]
pub struct TextStyle {
  pub bold: Option<bool>,
  pub italic: Option<bool>,
  pub font_size_pt: Option<f64>,
  pub font_east_asia: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TemplatePageSpec {
  pub width: u32,
  pub height: u32,
  pub margin: TemplateMargin,
}

#[derive(Debug, Clone)]
pub struct TemplateMargin {
  pub top: i32,
  pub right: i32,
  pub bottom: i32,
  pub left: i32,
}

#[derive(Debug, Clone)]
pub struct TemplatePhotoSpec {
  pub placement: String,
  pub width_px: u32,
  pub height_px: u32,
}

#[derive(Debug, Clone)]
pub struct TemplateLayoutSpec {
  pub entry_tab_center: i64,
  pub internship_tab_center: i64,
  pub entry_tab_right: i64,
  pub bullet_indent: BulletIndent,
}

#[derive(Debug, Clone)]
pub struct BulletIndent {
  pub left: i64,
  pub hanging: i64,
}

#[derive(Debug, Clone)]
pub struct TemplateStyles {
  pub name: TextStyle,
  pub tagline: TextStyle,
  pub contact: TextStyle,
  pub section_heading: TextStyle,
  pub entry_title: TextStyle,
  pub entry_tech: TextStyle,
  pub entry_meta: TextStyle,
  pub skill_line: TextStyle,
  pub body: TextStyle,
}

#[derive(Debug, Clone)]
pub struct TemplateDefinition {
  pub id: String,
  pub slug: String,
  pub display_name: String,
  pub version: String,
  pub description: String,
  pub photo_in_template: bool,
  pub photo: Option<TemplatePhotoSpec>,
  pub layout: TemplateLayoutSpec,
  pub section_order: Vec<String>,
  pub page: TemplatePageSpec,
  pub styles: TemplateStyles,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
  id: String,
  slug: String,
  display_name: String,
  version: String,
  #[serde(default)]
  description: String,
  #[serde(default)]
  photo_in_template: bool,
  photo: Option<ManifestPhoto>,
  layout: Option<ManifestLayout>,
  section_order: Vec<String>,
  page: ManifestPage,
  styles: ManifestStyles,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestPhoto {
  placement: String,
  width_px: u32,
  height_px: u32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestLayout {
  entry_tab_center: Option<i64>,
  internship_tab_center: Option<i64>,
  entry_tab_right: Option<i64>,
  bullet_indent: Option<ManifestBullet>,
}

#[derive(Debug, Deserialize)]
struct ManifestBullet {
  left: Option<i64>,
  hanging: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct ManifestPage {
  width: u32,
  height: u32,
  margin: ManifestMargin,
}

#[derive(Debug, Deserialize)]
struct ManifestMargin {
  top: i32,
  right: i32,
  bottom: i32,
  left: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestStyles {
  name: ManifestStyle,
  tagline: ManifestStyle,
  contact: ManifestStyle,
  section_heading: ManifestStyle,
  entry_title: ManifestStyle,
  entry_tech: Option<ManifestStyle>,
  entry_meta: ManifestStyle,
  skill_line: ManifestStyle,
  body: ManifestStyle,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestStyle {
  bold: Option<bool>,
  italic: Option<bool>,
  font_size_pt: Option<f64>,
  font_east_asia: Option<String>,
}

static CACHE: Mutex<Option<(String, Vec<(String, TemplateDefinition)>)>> = Mutex::new(None);

fn style_from(m: &ManifestStyle) -> TextStyle {
  TextStyle {
    bold: m.bold,
    italic: m.italic,
    font_size_pt: m.font_size_pt,
    font_east_asia: m.font_east_asia.clone(),
  }
}

fn load_registry(templates_dir: &Path) -> Vec<(String, TemplateDefinition)> {
  let key = templates_dir.display().to_string();
  if let Ok(guard) = CACHE.lock() {
    if let Some((cached_key, defs)) = guard.as_ref() {
      if *cached_key == key {
        return defs.clone();
      }
    }
  }

  let mut out = Vec::new();
  let Ok(entries) = fs::read_dir(templates_dir) else {
    return out;
  };
  let mut dirs: Vec<_> = entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
  dirs.sort();
  for dir in dirs {
    if !dir.is_dir() {
      continue;
    }
    let manifest = dir.join("manifest.json");
    let Ok(raw) = fs::read_to_string(&manifest) else {
      continue;
    };
    let Ok(m) = serde_json::from_str::<ManifestFile>(&raw) else {
      continue;
    };
    let entry_meta = style_from(&m.styles.entry_meta);
    let entry_tech = m
      .styles
      .entry_tech
      .as_ref()
      .map(style_from)
      .unwrap_or_else(|| TextStyle {
        bold: Some(false),
        italic: Some(true),
        font_size_pt: Some(
          (entry_meta.font_size_pt.unwrap_or(10.5) - 1.0).max(8.0),
        ),
        font_east_asia: entry_meta
          .font_east_asia
          .clone()
          .or_else(|| Some("宋体".into())),
      });
    let layout = m.layout.unwrap_or(ManifestLayout {
      entry_tab_center: None,
      internship_tab_center: None,
      entry_tab_right: None,
      bullet_indent: None,
    });
    let bullet = layout.bullet_indent.unwrap_or(ManifestBullet {
      left: None,
      hanging: None,
    });
    let def = TemplateDefinition {
      id: m.id.clone(),
      slug: m.slug,
      display_name: m.display_name,
      version: m.version,
      description: m.description,
      photo_in_template: m.photo_in_template,
      photo: m.photo.map(|p| TemplatePhotoSpec {
        placement: p.placement,
        width_px: p.width_px,
        height_px: p.height_px,
      }),
      layout: TemplateLayoutSpec {
        entry_tab_center: layout.entry_tab_center.unwrap_or(DEFAULT_ENTRY_TAB_CENTER),
        internship_tab_center: layout
          .internship_tab_center
          .unwrap_or(DEFAULT_INTERNSHIP_TAB_CENTER),
        entry_tab_right: layout.entry_tab_right.unwrap_or(DEFAULT_ENTRY_TAB_RIGHT),
        bullet_indent: BulletIndent {
          left: bullet.left.unwrap_or(DEFAULT_BULLET_LEFT),
          hanging: bullet.hanging.unwrap_or(DEFAULT_BULLET_HANGING),
        },
      },
      section_order: m.section_order,
      page: TemplatePageSpec {
        width: m.page.width,
        height: m.page.height,
        margin: TemplateMargin {
          top: m.page.margin.top,
          right: m.page.margin.right,
          bottom: m.page.margin.bottom,
          left: m.page.margin.left,
        },
      },
      styles: TemplateStyles {
        name: style_from(&m.styles.name),
        tagline: style_from(&m.styles.tagline),
        contact: style_from(&m.styles.contact),
        section_heading: style_from(&m.styles.section_heading),
        entry_title: style_from(&m.styles.entry_title),
        entry_tech,
        entry_meta,
        skill_line: style_from(&m.styles.skill_line),
        body: style_from(&m.styles.body),
      },
    };
    out.push((m.id, def));
  }

  if let Ok(mut guard) = CACHE.lock() {
    *guard = Some((key, out.clone()));
  }
  out
}

/// Clear registry cache (tests).
#[cfg(test)]
pub fn reset_template_registry_cache() {
  if let Ok(mut guard) = CACHE.lock() {
    *guard = None;
  }
}

pub fn get_template(templates_dir: &Path, id: &str) -> Option<TemplateDefinition> {
  load_registry(templates_dir)
    .into_iter()
    .find(|(tid, _)| tid == id)
    .map(|(_, d)| d)
}

/// Scan `templates/*/manifest.json` (or bundled desktop-resources).
pub fn list_template_meta(templates_dir: &Path) -> Vec<TemplateMeta> {
  let mut out: Vec<TemplateMeta> = load_registry(templates_dir)
    .into_iter()
    .map(|(_, d)| TemplateMeta {
      id: d.id,
      label: d.display_name,
      description: d.description,
    })
    .collect();
  if out.is_empty() {
    return fallback_meta();
  }
  out.sort_by(|a, b| {
    if a.id == DEFAULT_TEMPLATE_ID {
      std::cmp::Ordering::Less
    } else if b.id == DEFAULT_TEMPLATE_ID {
      std::cmp::Ordering::Greater
    } else {
      a.id.cmp(&b.id)
    }
  });
  out
}

fn fallback_meta() -> Vec<TemplateMeta> {
  vec![TemplateMeta {
    id: DEFAULT_TEMPLATE_ID.into(),
    label: "蓝黑简洁简历".into(),
    description: "蓝黑简洁：居中证件照→姓名→应聘岗位→联系；三栏条目".into(),
  }]
}

/// True when `id` appears in scanned template manifests (or fallback default).
pub fn is_registered_template_id(templates_dir: &Path, id: &str) -> bool {
  list_template_meta(templates_dir)
    .iter()
    .any(|t| t.id == id)
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::path::PathBuf;

  #[test]
  fn reads_repo_templates_when_present() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../templates");
    if !root.is_dir() {
      return;
    }
    reset_template_registry_cache();
    let meta = list_template_meta(&root);
    assert!(!meta.is_empty());
    assert!(meta.iter().any(|t| t.id == DEFAULT_TEMPLATE_ID));
    let def = get_template(&root, DEFAULT_TEMPLATE_ID).expect("default-v1");
    assert_eq!(def.styles.name.font_size_pt, Some(22.0));
    assert_eq!(def.layout.internship_tab_center, 6520);
    assert!(def.photo_in_template);
  }
}
