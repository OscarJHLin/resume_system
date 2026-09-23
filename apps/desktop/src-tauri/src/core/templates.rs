//! Template pack meta — mirrors `listTemplateMeta` in apps/server registry.

use std::fs;
use std::path::Path;

use serde::Deserialize;

use crate::core::models::TemplateMeta;

pub const DEFAULT_TEMPLATE_ID: &str = "default-v1";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestFile {
  id: String,
  display_name: String,
  #[serde(default)]
  description: String,
}

/// Scan `templates/*/manifest.json` (or bundled desktop-resources).
pub fn list_template_meta(templates_dir: &Path) -> Vec<TemplateMeta> {
  let mut out = Vec::new();
  let Ok(entries) = fs::read_dir(templates_dir) else {
    return fallback_meta();
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
    out.push(TemplateMeta {
      id: m.id,
      label: m.display_name,
      description: m.description,
    });
  }
  if out.is_empty() {
    return fallback_meta();
  }
  // Prefer default-v1 first (stable ordering for meta).
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
    let meta = list_template_meta(&root);
    assert!(!meta.is_empty());
    assert!(meta.iter().any(|t| t.id == DEFAULT_TEMPLATE_ID));
  }
}
