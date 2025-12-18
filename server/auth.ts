import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
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
import { storage } from "./storage";
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

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

  const MemoryStoreClass = await getMemoryStore();
  
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
      store: new MemoryStoreClass({ checkPeriod: 86400000 }),
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

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Check if user already exists with this Google ID
            let user = await storage.getUserByGoogleId?.(profile.id);

            if (user) {
              return done(null, user);
            }

            // Check if user exists with same email
            const email = profile.emails?.[0]?.value;
            if (email) {
              user = await storage.getUserByEmail?.(email);
              if (user) {
                // Link Google account to existing user
                await storage.updateUser(user.id, {
                  googleId: profile.id,
                  avatar: profile.photos?.[0]?.value
                });
                return done(null, user);
              }
            }

            // Create new user
            const newUser = await storage.createUser({
              username: profile.displayName || `google_${profile.id}`,
              email: email,
              googleId: profile.id,
              avatar: profile.photos?.[0]?.value,
              organizationName: profile.displayName || undefined,
              // No password for OAuth users
              password: null as any,
            });

            return done(null, newUser);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

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

  // Google OAuth Routes
  app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/auth?error=google_auth_failed" }),
    (req: Request, res: Response) => {
      // Successful authentication, redirect to app
      res.redirect("/app");
    }
  );
}

