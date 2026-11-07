/* Primitive-level types. These live in lib/ because components and pure
   functions need them and neither may import data/ (the sample model).
   Domain entities (Workspace, File, Note…) stay in data/types.ts until the
   service layer exists; they carry product knowledge, these do not. */

export type Id = string;

export type FileKind = 'pdf' | 'csv' | 'md' | 'parquet' | 'json' | 'png' | 'txt';
