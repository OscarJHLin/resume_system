//! Template → ResumeIR — mirrors `apps/server/src/modules/template/index.ts`.

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::core::domain::display_module_time_range;
use crate::core::error::ApiError;
use crate::core::models::{Profile, SectionPlacement};
use crate::core::templates::{
  get_template, TemplateDefinition, TemplateLayoutSpec, TemplateStyles, TextStyle,
  DEFAULT_TEMPLATE_ID,
};

pub const PERSONAL_STATEMENT_LABEL: &str = "个人陈述";
pub const TARGET_ROLE_PREFIX: &str = "应聘岗位：";

fn section_label(section: &str) -> String {
  match section {
    "basic" => "基本信息".into(),
    "education" => "教育背景".into(),
    "skills" => "技术能力".into(),
    "projects" => "项目经历".into(),
    "internships" => "实习经历".into(),
    "awards" => "获奖与证书".into(),
    other => other.to_string(),
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IrTextStyle {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub bold: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub italic: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub font_size_pt: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub font_east_asia: Option<String>,
}

impl From<&TextStyle> for IrTextStyle {
  fn from(s: &TextStyle) -> Self {
    Self {
      bold: s.bold,
      italic: s.italic,
      font_size_pt: s.font_size_pt,
      font_east_asia: s.font_east_asia.clone(),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IrRun {
  pub text: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub style: Option<IrTextStyle>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum IrBlock {
  #[serde(rename = "heading")]
  Heading {
    level: u8,
    runs: Vec<IrRun>,
    #[serde(skip_serializing_if = "Option::is_none")]
    alignment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    spacing_before_pt: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    spacing_after_pt: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    border_bottom: Option<bool>,
  },
  #[serde(rename = "paragraph")]
  Paragraph {
    runs: Vec<IrRun>,
    #[serde(skip_serializing_if = "Option::is_none")]
    spacing_after_pt: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    spacing_before_pt: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    alignment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    bullet: Option<bool>,
    /// `true` / center twips number — mirrors domain `entryTabs`.
    #[serde(skip_serializing_if = "Option::is_none")]
    entry_tabs: Option<EntryTabs>,
  },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum EntryTabs {
  Flag(bool),
  Center(i64),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeIR {
  pub template_id: String,
  pub template_version: String,
  pub blocks: Vec<IrBlock>,
  pub meta: ResumeIrMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeIrMeta {
  pub title: String,
  pub generated_at: String,
}

/// Placeholder profile when resume has no applied 基本信息 card.
pub fn placeholder_profile() -> Profile {
  Profile {
    id: String::new(),
    name: String::new(),
    gender: String::new(),
    phone: None,
    email: None,
    wechat: None,
    qq: None,
    location: None,
    summary: None,
    statement: None,
    education: serde_json::json!([]),
    skills: serde_json::json!([]),
    tags: serde_json::json!([]),
    notes: None,
    has_photo: false,
    created_at: String::new(),
    updated_at: String::new(),
  }
}

pub fn render_to_ir(
  templates_dir: &Path,
  template_id: &str,
  profile: &Profile,
  placements: &[SectionPlacement],
  clock: impl FnOnce() -> String,
) -> Result<ResumeIR, ApiError> {
  let def = get_template(templates_dir, template_id).ok_or_else(|| {
    ApiError::bad_request(format!("Unknown template: {template_id}"))
  })?;
  Ok(render_with_def(&def, profile, placements, clock()))
}

fn render_with_def(
  def: &TemplateDefinition,
  profile: &Profile,
  placements: &[SectionPlacement],
  generated_at: String,
) -> ResumeIR {
  let style = &def.styles;
  let layout = &def.layout;
  let mut blocks: Vec<IrBlock> = Vec::new();

  blocks.push(IrBlock::Heading {
    level: 1,
    alignment: Some("center".into()),
    spacing_after_pt: Some(6.0),
    spacing_before_pt: None,
    border_bottom: None,
    runs: vec![IrRun {
      text: if profile.name.trim().is_empty() {
        "姓名".into()
      } else {
        profile.name.clone()
      },
      style: Some(IrTextStyle::from(&style.name)),
    }],
  });

  if let Some(summary) = profile.summary.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
    let tagline = IrTextStyle::from(&style.tagline);
    let mut tagline_plain = tagline.clone();
    tagline_plain.bold = Some(false);
    blocks.push(para(
      vec![
        IrRun {
          text: TARGET_ROLE_PREFIX.into(),
          style: Some(tagline),
        },
        IrRun {
          text: summary.to_string(),
          style: Some(tagline_plain),
        },
      ],
      ParaOpts {
        alignment: Some("center"),
        spacing_after_pt: Some(4.0),
        ..Default::default()
      },
    ));
  }

  let wechat_line = profile
    .wechat
    .as_ref()
    .map(|w| w.trim())
    .filter(|w| !w.is_empty())
    .map(|w| format!("微信: {w}"));
  let contact = [
    profile.location.as_deref(),
    profile.phone.as_deref(),
    profile.email.as_deref(),
    wechat_line.as_deref(),
  ]
  .into_iter()
  .flatten()
  .filter(|s| !s.trim().is_empty())
  .collect::<Vec<_>>()
  .join(" | ");
  if !contact.is_empty() {
    blocks.push(para(
      vec![IrRun {
        text: contact,
        style: Some(IrTextStyle::from(&style.contact)),
      }],
      ParaOpts {
        alignment: Some("center"),
        spacing_after_pt: Some(0.0),
        ..Default::default()
      },
    ));
  }

  if let Some(statement) = profile
    .statement
    .as_ref()
    .map(|s| s.trim())
    .filter(|s| !s.is_empty())
  {
    blocks.push(section_heading(PERSONAL_STATEMENT_LABEL, style));
    for line in statement
      .split('\n')
      .map(str::trim)
      .filter(|l| !l.is_empty())
    {
      blocks.push(para(
        vec![IrRun {
          text: line.to_string(),
          style: Some(IrTextStyle::from(&style.body)),
        }],
        ParaOpts {
          spacing_after_pt: Some(0.8),
          ..Default::default()
        },
      ));
    }
  }

  if let Some(arr) = profile.education.as_array() {
    if !arr.is_empty() {
      blocks.push(section_heading(&section_label("education"), style));
      for edu in arr {
        let school = edu
          .get("school")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .trim();
        let school = if school.is_empty() { "学校" } else { school };
        let degree = opt_str(edu.get("degree"));
        let major = opt_str(edu.get("major"));
        let mid = [degree.as_deref(), major.as_deref()]
          .into_iter()
          .flatten()
          .collect::<Vec<_>>()
          .join(" · ");
        let time = opt_str(edu.get("timeRange"));
        blocks.push(entry_line(
          style,
          school,
          Mid {
            tech: None,
            text: if mid.is_empty() { None } else { Some(mid.as_str()) },
          },
          time.as_deref(),
          EntryOpts {
            spacing_after_pt: Some(0.8),
            entry_tab_center: Some(layout.entry_tab_center),
            ..Default::default()
          },
        ));
        let detail = [
          opt_str(edu.get("gpa")).map(|g| format!("GPA：{g}")),
          opt_str(edu.get("rank")),
          opt_str(edu.get("courses")).map(|c| format!("课程：{c}")),
        ]
        .into_iter()
        .flatten()
        .collect::<Vec<_>>()
        .join("；");
        if !detail.is_empty() {
          blocks.push(para(
            vec![IrRun {
              text: detail,
              style: Some(IrTextStyle::from(&style.body)),
            }],
            ParaOpts {
              spacing_after_pt: Some(0.8),
              ..Default::default()
            },
          ));
        }
      }
    }
  }

  if let Some(arr) = profile.skills.as_array() {
    if !arr.is_empty() {
      blocks.push(section_heading(&section_label("skills"), style));
      for skill in arr {
        let title = skill
          .get("title")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .trim()
          .to_string();
        let body = skill
          .get("body")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .trim()
          .replace('\n', "；");
        if title.is_empty() && body.is_empty() {
          continue;
        }
        let runs = if !title.is_empty() && !body.is_empty() {
          vec![
            IrRun {
              text: format!("{title}："),
              style: Some(IrTextStyle::from(&style.skill_line)),
            },
            IrRun {
              text: body,
              style: Some(IrTextStyle::from(&style.body)),
            },
          ]
        } else {
          let text = if title.is_empty() { body } else { title.clone() };
          let st = if !title.is_empty() {
            &style.skill_line
          } else {
            &style.body
          };
          vec![IrRun {
            text,
            style: Some(IrTextStyle::from(st)),
          }]
        };
        blocks.push(para(
          runs,
          ParaOpts {
            spacing_after_pt: Some(0.4),
            bullet: Some(false),
            ..Default::default()
          },
        ));
      }
    }
  }

  for section in &def.section_order {
    if section == "skills" {
      continue;
    }
    let mut items: Vec<&SectionPlacement> = placements
      .iter()
      .filter(|p| p.section == *section)
      .collect();
    items.sort_by_key(|p| p.sort_order);
    if items.is_empty() {
      continue;
    }
    blocks.push(section_heading(&section_label(section), style));
    for item in items {
      blocks.extend(render_snapshot(style, layout, item, section));
    }
  }

  ResumeIR {
    template_id: def.id.clone(),
    template_version: def.version.clone(),
    blocks,
    meta: ResumeIrMeta {
      title: if profile.name.trim().is_empty() {
        "resume".into()
      } else {
        profile.name.clone()
      },
      generated_at,
    },
  }
}

fn render_snapshot(
  style: &TemplateStyles,
  layout: &TemplateLayoutSpec,
  placement: &SectionPlacement,
  section: &str,
) -> Vec<IrBlock> {
  let s = &placement.snapshot;
  let mut out = Vec::new();

  if section == "awards" {
    let title = snap_str(s, "title").unwrap_or_default();
    let level = snap_str(s, "projectType").unwrap_or_default();
    let org = snap_str(s, "subtitle").unwrap_or_default();
    let when = display_module_time_range(snap_str(s, "timeRange").as_deref());
    let body = snap_str(s, "body").unwrap_or_default();
    let parts = [title.as_str(), level.as_str(), org.as_str(), when.as_str(), body.trim()];
    let line = parts
      .into_iter()
      .filter(|p| !p.is_empty())
      .collect::<Vec<_>>()
      .join("，");
    out.push(para(
      vec![IrRun {
        text: line,
        style: Some(IrTextStyle::from(&style.body)),
      }],
      ParaOpts {
        spacing_after_pt: Some(0.8),
        ..Default::default()
      },
    ));
    return out;
  }

  let tech = snap_str(s, "projectType");
  let duty = snap_str(s, "subtitle");
  let right = {
    let raw = snap_str(s, "timeRange");
    let d = display_module_time_range(raw.as_deref());
    if d.is_empty() { None } else { Some(d) }
  };
  let tab_center = if section == "internships" {
    layout.internship_tab_center
  } else {
    layout.entry_tab_center
  };
  let title = snap_str(s, "title").unwrap_or_default();

  out.push(entry_line(
    style,
    &title,
    Mid {
      tech: tech.as_deref(),
      text: duty.as_deref(),
    },
    right.as_deref(),
    EntryOpts {
      spacing_after_pt: Some(0.8),
      spacing_before_pt: if placement.sort_order > 0 {
        Some(6.5)
      } else {
        None
      },
      entry_tab_center: Some(tab_center),
    },
  ));

  if let Some(body) = snap_str(s, "body") {
    for line in body.split('\n').map(str::trim).filter(|l| !l.is_empty()) {
      out.push(para(
        vec![IrRun {
          text: line.to_string(),
          style: Some(IrTextStyle::from(&style.body)),
        }],
        ParaOpts {
          spacing_after_pt: Some(0.8),
          ..Default::default()
        },
      ));
    }
  }

  out
}

struct Mid<'a> {
  tech: Option<&'a str>,
  text: Option<&'a str>,
}

#[derive(Default)]
struct EntryOpts {
  spacing_after_pt: Option<f64>,
  spacing_before_pt: Option<f64>,
  entry_tab_center: Option<i64>,
}

fn entry_line(
  style: &TemplateStyles,
  title: &str,
  mid: Mid<'_>,
  time: Option<&str>,
  opts: EntryOpts,
) -> IrBlock {
  let tech = mid.tech.map(str::trim).filter(|s| !s.is_empty());
  let text = mid.text.map(str::trim).filter(|s| !s.is_empty());
  let has_mid = tech.is_some() || text.is_some();
  let mut runs = vec![IrRun {
    text: title.to_string(),
    style: Some(IrTextStyle::from(&style.entry_title)),
  }];
  if has_mid || time.is_some() {
    runs.push(IrRun {
      text: "\t".into(),
      style: Some(IrTextStyle::from(&style.entry_meta)),
    });
    if let Some(t) = tech {
      runs.push(IrRun {
        text: t.to_string(),
        style: Some(IrTextStyle::from(&style.entry_tech)),
      });
    }
    if tech.is_some() && text.is_some() {
      runs.push(IrRun {
        text: " · ".into(),
        style: Some(IrTextStyle::from(&style.entry_meta)),
      });
    }
    if let Some(t) = text {
      runs.push(IrRun {
        text: t.to_string(),
        style: Some(IrTextStyle::from(&style.entry_meta)),
      });
    }
    if !has_mid {
      runs.push(IrRun {
        text: String::new(),
        style: Some(IrTextStyle::from(&style.entry_meta)),
      });
    }
  }
  if let Some(t) = time {
    runs.push(IrRun {
      text: "\t".into(),
      style: Some(IrTextStyle::from(&style.entry_meta)),
    });
    runs.push(IrRun {
      text: t.to_string(),
      style: Some(IrTextStyle::from(&style.entry_meta)),
    });
  }
  para(
    runs,
    ParaOpts {
      spacing_after_pt: opts.spacing_after_pt,
      spacing_before_pt: opts.spacing_before_pt,
      entry_tabs: Some(EntryTabs::Center(
        opts.entry_tab_center.unwrap_or(DEFAULT_ENTRY_TAB),
      )),
      ..Default::default()
    },
  )
}

const DEFAULT_ENTRY_TAB: i64 = 4933;

#[derive(Default)]
struct ParaOpts<'a> {
  spacing_after_pt: Option<f64>,
  spacing_before_pt: Option<f64>,
  alignment: Option<&'a str>,
  bullet: Option<bool>,
  entry_tabs: Option<EntryTabs>,
}

fn para(runs: Vec<IrRun>, opts: ParaOpts<'_>) -> IrBlock {
  IrBlock::Paragraph {
    runs,
    spacing_after_pt: opts.spacing_after_pt,
    spacing_before_pt: opts.spacing_before_pt,
    alignment: opts.alignment.map(str::to_string),
    bullet: opts.bullet,
    entry_tabs: opts.entry_tabs,
  }
}

fn section_heading(text: &str, style: &TemplateStyles) -> IrBlock {
  IrBlock::Heading {
    level: 2,
    border_bottom: Some(true),
    spacing_before_pt: Some(10.0),
    spacing_after_pt: Some(6.0),
    alignment: None,
    runs: vec![IrRun {
      text: text.to_string(),
      style: Some(IrTextStyle::from(&style.section_heading)),
    }],
  }
}

fn opt_str(v: Option<&Value>) -> Option<String> {
  v.and_then(|x| x.as_str())
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(str::to_string)
}

fn snap_str(s: &Value, key: &str) -> Option<String> {
  opt_str(s.get(key))
}

/// Style probe for tests — mirrors Node `styleProbeFor`.
pub fn style_probe_for(templates_dir: &Path, template_id: &str) -> Option<StyleProbe> {
  let def = get_template(templates_dir, template_id)?;
  Some(StyleProbe {
    name_pt: def.styles.name.font_size_pt.unwrap_or(0.0),
    section_pt: def.styles.section_heading.font_size_pt.unwrap_or(0.0),
    body_pt: def.styles.body.font_size_pt.unwrap_or(0.0),
    contact_pt: def.styles.contact.font_size_pt.unwrap_or(0.0),
    heiti: def.styles.name.font_east_asia.unwrap_or_default(),
    song: def.styles.body.font_east_asia.unwrap_or_default(),
    section_order: def.section_order,
    photo_in_template: def.photo_in_template,
    photo_placement: def.photo.map(|p| p.placement),
  })
}

#[derive(Debug, Clone)]
pub struct StyleProbe {
  pub name_pt: f64,
  pub section_pt: f64,
  pub body_pt: f64,
  pub contact_pt: f64,
  pub heiti: String,
  pub song: String,
  pub section_order: Vec<String>,
  pub photo_in_template: bool,
  pub photo_placement: Option<String>,
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::core::templates::reset_template_registry_cache;
  use std::path::PathBuf;

  fn templates_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../templates")
  }

  #[test]
  fn ir_snapshot_blue_black_simple() {
    let root = templates_dir();
    if !root.is_dir() {
      return;
    }
    reset_template_registry_cache();
    let profile = Profile {
      id: "p1".into(),
      name: "测测".into(),
      gender: "男".into(),
      phone: Some("138".into()),
      email: Some("a@b.c".into()),
      wechat: Some("wx".into()),
      qq: None,
      location: Some("上海".into()),
      summary: Some("后端开发".into()),
      statement: Some("热爱编程\n持续学习".into()),
      education: serde_json::json!([{
        "id": "e1",
        "school": "某某大学",
        "degree": "本科",
        "major": "CS",
        "startDate": "2020-09",
        "endDate": "",
        "timeRange": "2020.09 - 至今",
        "gpa": "3.8"
      }]),
      skills: serde_json::json!([{
        "id": "s1",
        "title": "语言",
        "body": "Rust；TypeScript"
      }]),
      tags: serde_json::json!([]),
      notes: None,
      has_photo: false,
      created_at: "".into(),
      updated_at: "".into(),
    };
    let placements = vec![
      SectionPlacement {
        id: "pl1".into(),
        section: "projects".into(),
        sort_order: 0,
        snapshot: serde_json::json!({
          "title": "拼履",
          "projectType": "Rust",
          "subtitle": "核心开发",
          "timeRange": "2026.01",
          "body": "实现导出\n对齐 Node"
        }),
      },
      SectionPlacement {
        id: "pl2".into(),
        section: "awards".into(),
        sort_order: 0,
        snapshot: serde_json::json!({
          "title": "优秀学生",
          "projectType": "校级",
          "subtitle": "学校",
          "timeRange": "2024",
          "body": ""
        }),
      },
    ];
    let ir = render_to_ir(
      &root,
      DEFAULT_TEMPLATE_ID,
      &profile,
      &placements,
      || "2026-09-23T00:00:00.000Z".into(),
    )
    .unwrap();
    assert_eq!(ir.template_id, DEFAULT_TEMPLATE_ID);
    assert_eq!(ir.template_version, "1.2.1");
    // Name heading
    match &ir.blocks[0] {
      IrBlock::Heading { level, runs, .. } => {
        assert_eq!(*level, 1);
        assert_eq!(runs[0].text, "测测");
      }
      _ => panic!("expected name heading"),
    }
    let texts: Vec<String> = ir
      .blocks
      .iter()
      .flat_map(|b| match b {
        IrBlock::Heading { runs, .. } | IrBlock::Paragraph { runs, .. } => {
          runs.iter().map(|r| r.text.clone()).collect::<Vec<_>>()
        }
      })
      .collect();
    assert!(texts.iter().any(|t| t.contains("应聘岗位：")));
    assert!(texts.iter().any(|t| t == "教育背景"));
    assert!(texts.iter().any(|t| t == "技术能力"));
    assert!(texts.iter().any(|t| t == "项目经历"));
    assert!(texts.iter().any(|t| t == "获奖与证书"));
    assert!(texts.iter().any(|t| t.contains("校级")));
    assert!(texts.iter().any(|t| t.contains("2026.01 - 至今")));
    let probe = style_probe_for(&root, DEFAULT_TEMPLATE_ID).unwrap();
    assert_eq!(probe.name_pt, 22.0);
    assert_eq!(probe.heiti, "黑体");
    assert_eq!(probe.song, "宋体");
  }
}
