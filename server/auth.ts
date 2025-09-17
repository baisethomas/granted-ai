import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import MemoryStoreFactory from "memorystore";
import crypto from "crypto";
import { storage } from "./storage";

const MemoryStore = MemoryStoreFactory(session);

function hashPassword(password: string, salt?: string) {
  const saltToUse = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, saltToUse, 64).toString("hex");
  return { salt: saltToUse, hash };
}

function verifyPassword(password: string, storedHash: string, salt: string) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(storedHash, "hex"));
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
      },
      store: new MemoryStore({ checkPeriod: 86400000 }),
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

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
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

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err, user, info) => {
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

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.user) return res.json(null);
    const u = req.user as any;
    res.json({ id: u.id, username: u.username, organizationName: u.organizationName });
  });
}


