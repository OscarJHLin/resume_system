//! Plan C Phase 4: Rust core (SQLite + localhost HTTP CRUD + DOCX export).
//!
//! Mirrors Node Fastify `/api/*` JSON shapes. Desktop default is in-process Rust;
//! optional monorepo escape hatch: `RESUME_API=node`.

pub mod api;
pub mod db;
pub mod domain;
pub mod error;
pub mod export;
pub mod models;
pub mod render;
pub mod store;
pub mod templates;

pub use api::{serve, AppState};
pub use db::{ensure_db, open_database, photos_dir};
pub use store::Store;
pub use templates::{list_template_meta, DEFAULT_TEMPLATE_ID};
