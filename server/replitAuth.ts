import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

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
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, async (err: any, user: any) => {
      if (err) {
        console.error("Authentication error:", err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        return res.redirect("/api/login");
      }

      req.logIn(user, async (loginErr) => {
        if (loginErr) {
          console.error("Login error:", loginErr);
          return res.redirect("/api/login");
        }

        try {
          // Get user from database to check admin status
          const userId = user.claims?.sub;
          if (!userId) {
            return res.redirect("/");
          }

          const dbUser = await storage.getUser(userId);
          
          // If user is a super admin, redirect to default admin portal
          if (dbUser?.isSuperAdmin) {
            return res.redirect("/admin/fg-baseball-11u-13u-2025-08");
          }
          
          // If user is an organization admin, redirect to their first organization's tournaments
          const userOrgs = await storage.getUserOrganizations(userId);
          if (userOrgs && userOrgs.length > 0) {
            // Get the first tournament of the first organization
            const org = userOrgs[0];
            const tournaments = await storage.getTournaments(org.id);
            
            if (tournaments && tournaments.length > 0) {
              return res.redirect(`/admin/${tournaments[0].id}`);
            }
            
            // If no tournaments yet, still go to admin portal with default tournament
            return res.redirect("/admin/fg-baseball-11u-13u-2025-08");
          }
          
          // Not an admin, redirect to homepage
          return res.redirect("/");
        } catch (error) {
          console.error("Error checking admin status:", error);
          return res.redirect("/");
        }
      });
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // First check if user is authenticated
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  // Refresh token if needed
  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }
  }

  // Check if user has admin privileges
  try {
    const { storage } = await import("./storage");
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);
    
    if (!dbUser || !dbUser.isAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Error checking admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const requireSuperAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // First check if user is authenticated
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  // Refresh token if needed
  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }
  }

  // Check if user has super admin privileges
  try {
    const { storage } = await import("./storage");
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);
    
    if (!dbUser || !dbUser.isSuperAdmin) {
      return res.status(403).json({ message: "Forbidden - Super admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Error checking super admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Middleware to check if user is an organization admin (or super admin)
// Extracts organizationId from request params, body, or tournament association
export const requireOrgAdmin: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // First check if user is authenticated
  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized - Please login first" });
  }

  // Refresh token if needed
  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized - Session expired" });
    }
  }

  // Check organization admin permissions
  try {
    const { storage } = await import("./storage");
    const userId = user.claims.sub;
    const dbUser = await storage.getUser(userId);
    
    if (!dbUser) {
      return res.status(403).json({ message: "Forbidden - User not found" });
    }

    // Super admins can access everything
    if (dbUser.isSuperAdmin) {
      return next();
    }

    // Extract organizationId from request (params, body, or query)
    let organizationId = req.params.organizationId || req.body.organizationId || (req.query.organizationId as string);

    // If not directly provided, try to get it from tournament
    if (!organizationId && req.params.tournamentId) {
      const tournament = await storage.getTournament(req.params.tournamentId);
      organizationId = tournament?.organizationId;
    }

    if (!organizationId) {
      return res.status(400).json({ message: "Organization context required" });
    }

    // Check if user is an admin of this organization
    const isOrgAdmin = await storage.isOrganizationAdmin(userId, organizationId);
    
    if (!isOrgAdmin) {
      return res.status(403).json({ message: "Forbidden - Organization admin access required" });
    }

    return next();
  } catch (error) {
    console.error("Error checking organization admin status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};