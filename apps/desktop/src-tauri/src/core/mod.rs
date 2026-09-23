//! Plan C Phase 2: Rust core (SQLite + localhost HTTP CRUD).
//!
//! Mirrors Node Fastify `/api/*` JSON shapes. Default desktop flag remains
//! `RESUME_API=node`; set `RESUME_API=rust` for in-process API. Export DOCX
//! stays 501 until Phase 3 (use Node, or Node flag).

pub mod api;
pub mod db;
pub mod domain;
pub mod error;
pub mod models;
pub mod store;
pub mod templates;

pub use api::{serve, AppState};
pub use db::{ensure_db, photos_dir, open_database};
pub use store::Store;
pub use templates::{list_template_meta, DEFAULT_TEMPLATE_ID};
