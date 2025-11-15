import type { NextFunction, Request, Response } from "express";
import { createClient, type User } from "@supabase/supabase-js";
import { logger } from "../utils/logger.js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

export const supabaseAdminClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

export interface AuthenticatedRequest extends Request {
  supabaseUser?: User;
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const tokenFromQuery = typeof req.query.access_token === "string" ? req.query.access_token : null;
  return tokenFromQuery;
}

export async function requireSupabaseUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "OPTIONS") {
    return next();
  }

  if (!supabaseAdminClient) {
    logger.error("Supabase service role key or URL missing. Access denied.", { 
      path: req.path,
      method: req.method,
      requestId: req.id 
    });
    return res.status(500).json({ error: "Server authentication is not configured" });
  }

  const token = extractBearerToken(req);

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { data, error } = await supabaseAdminClient.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.supabaseUser = data.user;
    return next();
  } catch (error) {
    logger.error("Supabase auth verification failed", { 
      error,
      path: req.path,
      method: req.method,
      requestId: req.id 
    });
    return res.status(401).json({ error: "Unauthorized" });
  }
}
