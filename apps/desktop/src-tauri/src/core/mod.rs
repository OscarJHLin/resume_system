//! Plan C Phase 1: Rust read-only core (SQLite + localhost HTTP).
//!
//! Mirrors key GET routes from `apps/server` so UI / curl can对照 Node.
//! Writes remain on the Node sidecar until Phase 2 (`RESUME_API=node` default).

pub mod api;
pub mod db;
pub mod error;
pub mod models;
pub mod store;
pub mod templates;

pub use api::{serve, AppState};
pub use db::{ensure_db, photos_dir, open_database};
pub use store::Store;
pub use templates::{list_template_meta, DEFAULT_TEMPLATE_ID};
