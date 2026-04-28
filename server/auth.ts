import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimpleFactory from "connect-pg-simple";
import pg from "pg";
// Lazy import memorystore - it's slow to load and blocks startup
let MemoryStoreFactory: any = null;
async function getMemoryStoreFactory() {
  if (!MemoryStoreFactory) {
    const mod = await import("memorystore");
    MemoryStoreFactory = mod.default;
  }
  return MemoryStoreFactory;
}
import crypto from "crypto";
import { storage } from "./storage.js";
import { supabaseAdminClient } from "./middleware/supabaseAuth.js";
import { authRateLimiter } from "./middleware/rateLimiter.js";

// Lazy initialization - MemoryStoreFactory might be slow
let MemoryStore: any = null;
async function getMemoryStore() {
  if (!MemoryStore) {
    const Factory = await getMemoryStoreFactory();
    MemoryStore = Factory(session);
  }
  return MemoryStore;
}

function hashPassword(password: string, salt?: string) {
  const saltToUse = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, saltToUse, 64).toString("hex");
  return { salt: saltToUse, hash };
}

function verifyPassword(password: string, storedHash: string, salt: string) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

// One week. Long enough to keep "remember me" UX, short enough that a stolen
// cookie has a finite blast radius. Override via SESSION_MAX_AGE_MS if needed.
const DEFAULT_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET must be set in production. Refusing to start with a generated secret " +
          "because it would invalidate every session on cold-start.",
      );
    }
    console.warn(
      "[auth] SESSION_SECRET not set; generating an ephemeral one for development. " +
        "Sessions will be invalidated whenever the server restarts.",
    );
  }
  const resolvedSecret = sessionSecret || crypto.randomBytes(32).toString("hex");

  const isProduction = process.env.NODE_ENV === "production";
  const maxAgeMs = Number(process.env.SESSION_MAX_AGE_MS) || DEFAULT_SESSION_MAX_AGE_MS;

  const MemoryStoreClass = await getMemoryStore();

  let sessionStore: session.Store;
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const usePgSession =
    !!databaseUrl &&
    process.env.DISABLE_PG_SESSION_STORE !== "1" &&
    /^postgres(ql)?:\/\//i.test(databaseUrl);

  if (usePgSession) {
    const PgSessionStore = connectPgSimpleFactory(session);
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      max: Number(process.env.SESSION_PG_POOL_MAX || 4),
      connectionTimeoutMillis: 10_000,
    });
    sessionStore = new PgSessionStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    });
  } else {
    sessionStore = new MemoryStoreClass({ checkPeriod: 86400000 }) as session.Store;
  }

  app.use(
    session({
      secret: resolvedSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProduction,
        maxAge: maxAgeMs,
      },
      store: sessionStore,
    })
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (e) {
      done(e as Error);
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user: any = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid credentials" });

        // Support both in-memory (passwordHash/passwordSalt) and DB (password = "hash:salt")
        let storedHash: string | undefined;
        let salt: string | undefined;
        if (user.passwordHash && user.passwordSalt) {
          storedHash = user.passwordHash;
          salt = user.passwordSalt;
        } else if (user.password && typeof user.password === "string" && user.password.includes(":")) {
          const [hashPart, saltPart] = (user.password as string).split(":");
          storedHash = hashPart;
          salt = saltPart;
        }

        if (!storedHash || !salt) {
          return done(null, false, { message: "Invalid credentials" });
        }

        const ok = verifyPassword(password, storedHash, salt);
        if (!ok) return done(null, false, { message: "Invalid credentials" });
        return done(null, user);
      } catch (e) {
        return done(e as Error);
      }
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  // Apply stricter rate limiting to authentication endpoints
  app.post("/api/auth/signup", authRateLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, organizationName } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password required" });
      }
      const existing = await storage.getUserByUsername(username);
      if (existing) {
        return res.status(409).json({ error: "username already exists" });
      }
      const { hash, salt } = hashPassword(password);
      const created = await storage.createUser({
        username,
        organizationName,
        password: `${hash}:${salt}`,
      } as any);
      // auto-login after signup
      req.login(created, (err) => {
        if (err) return res.status(500).json({ error: "login failed" });
        res.json({ id: created.id, username: created.username, organizationName: created.organizationName });
      });
    } catch (e) {
      res.status(500).json({ error: "signup failed" });
    }
  });

  app.post("/api/auth/login", authRateLimiter, (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: unknown, user: Express.User | false, info: { message?: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ error: info?.message || "unauthorized" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const u = user as any;
        res.json({ id: u.id, username: u.username, organizationName: u.organizationName });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => {
      req.session?.destroy(() => {
        res.json({ ok: true });
      });
    });
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ") && supabaseAdminClient) {
      try {
        const token = header.slice(7).trim();
        const { data, error } = await supabaseAdminClient.auth.getUser(token);
        if (!error && data.user) {
          const { user } = data;
          return res.json({
            id: user.id,
            email: user.email,
            username: (user.user_metadata as any)?.username || user.email || user.id,
            organizationName: (user.user_metadata as any)?.organizationName,
            avatar: (user.user_metadata as any)?.avatar_url,
          });
        }
      } catch (error) {
        console.error("Failed to resolve Supabase user for /api/auth/me:", error);
      }
    }

    if (!req.user) return res.json(null);
    const u = req.user as any;
    res.json({ id: u.id, username: u.username, organizationName: u.organizationName, email: u.email, avatar: u.avatar });
  });
}
