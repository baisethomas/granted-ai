// Side-effect module: loads .env.local / .env into process.env.
//
// This MUST be the first import of the server entrypoint. In ESM, import
// declarations are hoisted and every imported module is evaluated before any
// statement in the importing file — so calling dotenv's config() from
// index.ts runs AFTER modules like storage.ts have already read
// process.env at their top level (which is how local dev silently fell back
// to in-memory storage; see GRA-61). A side-effect import executes in
// import order, before the modules imported after it.
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });
