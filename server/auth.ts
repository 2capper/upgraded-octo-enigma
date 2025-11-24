import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authService } from "./services/authService";
import { userService } from "./services/userService";
import { tournamentService } from "./services/tournamentService";
import { users } from "@shared/schema";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Local strategy for email/password login
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const user = await authService.login(email, password);
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  // Serialize user ID to session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from database
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await userService.getUser(id);
      if (!user) {
        // User no longer exists, clear the session
        return done(null, false);
      }
      // Sanitize user before attaching to req.user
      done(null, sanitizeUser(user));
    } catch (error) {
      console.error('Error deserializing user:', error);
      // Don't fail the request, just clear the session
      done(null, false);
    }
  });
}

// Helper function to sanitize user object (remove password fields)
export function sanitizeUser(user: typeof users.$inferSelect) {
  const { password, passwordResetToken, passwordResetExpires, ...sanitized } = user;
  return sanitized;
}

// Type extension for req.user
declare global {
  namespace Express {
    interface User extends Omit<typeof users.$inferSelect, 'password' | 'passwordResetToken' | 'passwordResetExpires'> {}
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  const user = req.user as any;
  
  if (!user.isAdmin) {
    return res.status(403).json({ message: "Forbidden - Admin access required" });
  }

  return next();
};

export const requireSuperAdmin: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  const user = req.user as any;
  
  if (!user.isSuperAdmin) {
    return res.status(403).json({ message: "Forbidden - Super admin access required" });
  }

  return next();
};

// Middleware to check if user is an organization admin (or super admin)
export const requireOrgAdmin: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  const user = req.user as any;
  
  // Super admins can access everything
  if (user.isSuperAdmin) {
    return next();
  }

  // Extract organizationId from request (params, body, or query)
  let organizationId = req.params.organizationId || req.body.organizationId || (req.query.organizationId as string);

  // If not directly provided, try to get it from tournament
  if (!organizationId && req.params.tournamentId) {
    try {
      const tournament = await tournamentService.getTournament(req.params.tournamentId);
      organizationId = tournament?.organizationId;
    } catch (error) {
      console.error("Error fetching tournament:", error);
    }
  }

  if (!organizationId) {
    return res.status(400).json({ message: "Organization context required" });
  }

  // Check if user is an admin of this organization
  try {
    const isOrgAdmin = await userService.isOrganizationAdmin(user.id, organizationId);
    
    if (!isOrgAdmin) {
      return res.status(403).json({ message: "Forbidden - Organization admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Error checking organization admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if organization has diamond booking enabled
export const requireDiamondBooking: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  try {
    const { organizationService } = await import("./services/organizationService");
    const organizationId = req.params.organizationId || req.params.orgId;
    
    if (!organizationId) {
      return res.status(400).json({ message: "Organization ID required" });
    }

    const organization = await organizationService.getOrganization(organizationId);
    
    if (!organization) {
      return res.status(404).json({ message: "Organization not found" });
    }

    if (!organization.hasDiamondBooking) {
      return res.status(403).json({ message: "Diamond booking is not enabled for this organization" });
    }

    return next();
  } catch (error) {
    console.error("Error checking diamond booking access:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
