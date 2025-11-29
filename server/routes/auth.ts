import { Router } from "express";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { sanitizeUser } from "../auth";
import { notificationService } from "../lib/notificationService";

const router = Router();

export function createAuthRouter(isTestEnv: boolean) {
  if (isTestEnv) {
    router.post('/test/login', async (req, res) => {
      try {
        const { email } = req.body;
        
        const user = await userService.upsertUser({
          id: 'test-admin-cypress-id',
          email: email || 'test-admin@dugoutdesk.ca',
          name: 'Test Admin (Cypress)',
          isAdmin: true,
          isSuperAdmin: true,
        });
        
        const sanitizedUser = sanitizeUser(user);
        
        const reqWithLogin = req as any;
        await new Promise<void>((resolve, reject) => {
          reqWithLogin.login(sanitizedUser, (err: any) => {
            if (err) return reject(err);
            resolve();
          });
        });
        
        res.json({ success: true, user: sanitizedUser });
      } catch (error) {
        console.error("Test login error:", error);
        res.status(500).json({ error: "Test login failed" });
      }
    });
  }

  router.get('/context', (req, res) => {
    const hostname = req.hostname;
    const isStorefront = hostname.startsWith('www.') || hostname === 'dugoutdesk.ca';
    
    res.json({
      hostname,
      isStorefront,
      isAdminApp: !isStorefront,
    });
  });

  router.post('/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      const user = await authService.register(email, password, firstName, lastName);
      const sanitizedUser = sanitizeUser(user);

      await new Promise<void>((resolve, reject) => {
        (req as any).login(sanitizedUser, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      res.json({ success: true, user: sanitizedUser });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ error: error.message || 'Registration failed' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await authService.login(email, password);
      const sanitizedUser = sanitizeUser(user);

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      await new Promise<void>((resolve, reject) => {
        (req as any).login(sanitizedUser, (err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });

      res.json({ success: true, user: sanitizedUser });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
  });

  router.post('/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      req.session.destroy(() => {
        res.json({ success: true });
      });
    });
  });

  router.get('/auth/me', (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json(req.user);
  });

  router.post('/auth/request-password-reset', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const resetData = await authService.requestPasswordReset(email);

      if (resetData) {
        try {
          await notificationService.sendPasswordResetEmail({
            email: resetData.user.email,
            name: resetData.user.name,
            resetToken: resetData.resetToken,
          });
          console.log(`Password reset process initiated`);
        } catch (emailError) {
          console.error('Password reset email error:', emailError);
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEV ONLY] Password reset requested for ${email}. Token: ${resetData.resetToken}`);
        }
      }

      res.json({ success: true, message: 'If the email exists, a reset link has been sent' });
    } catch (error: any) {
      console.error('Password reset request error:', error);
      res.status(500).json({ error: 'Failed to process password reset request' });
    }
  });

  router.post('/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and new password are required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }

      await authService.resetPassword(token, password);

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(400).json({ error: error.message || 'Password reset failed' });
    }
  });

  return router;
}

export default router;
