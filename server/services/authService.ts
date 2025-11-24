import bcrypt from 'bcrypt';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 24;

export const authService = {
  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [newUser] = await db.insert(users).values({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      isAdmin: false,
      isSuperAdmin: false,
    }).returning();

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      isAdmin: newUser.isAdmin,
      isSuperAdmin: newUser.isSuperAdmin,
    };
  },

  async login(email: string, password: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.password) {
      throw new Error('This account was created with a different login method');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isAdmin: user.isAdmin,
      isSuperAdmin: user.isSuperAdmin,
    };
  },

  async requestPasswordReset(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    await db.update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      })
      .where(eq(users.id, user.id));

    return {
      user: {
        email: user.email,
        name: user.name,
      },
      resetToken,
      resetExpires,
    };
  },

  async resetPassword(token: string, newPassword: string) {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token)).limit(1);

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new Error('Reset token has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.update(users)
      .set({
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      })
      .where(eq(users.id, user.id));

    return {
      id: user.id,
      email: user.email,
    };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password) {
      throw new Error('This account does not have a password set');
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));

    return true;
  },
};
