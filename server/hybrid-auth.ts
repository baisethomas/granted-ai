import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ieicdrcpckcjgcgfylaj.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllaWNkcmNwY2tjamdjZ2Z5bGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4MDAzODQsImV4cCI6MjA3MDM3NjM4NH0.5mgWjDuVk4-udmSC23TocxZjlXooF4ciWRRTAIdF2mo';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface HybridUser {
  id: string;
  email?: string;
  username?: string;
  organizationName?: string;
  auth_type: 'supabase' | 'express';
}

export async function getAuthenticatedUser(req: Request): Promise<HybridUser | null> {
  // Check for Supabase JWT token first (for Vercel deployment)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user && !error) {
        return {
          id: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          organizationName: user.user_metadata?.organizationName,
          auth_type: 'supabase'
        };
      }
    } catch (error) {
      console.log('Supabase auth failed:', error);
    }
  }

  // Check for Express session (for local development)
  if (req.user) {
    const user = req.user as any;
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      organizationName: user.organizationName,
      auth_type: 'express'
    };
  }

  return null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  getAuthenticatedUser(req)
    .then(user => {
      if (!user) {
        return res.status(401).json({
          error: "Authentication required",
          hint: "Include 'Authorization: Bearer <token>' header for Supabase auth or login via Express sessions"
        });
      }
      (req as any).hybridUser = user;
      next();
    })
    .catch(error => {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: "Authentication error" });
    });
}

export function getUserId(req: Request): string {
  const hybridUser = (req as any).hybridUser;
  if (!hybridUser) {
    throw new Error("User not authenticated");
  }
  return hybridUser.id;
}