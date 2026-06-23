import { Express } from "express";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { db } from "./db";
import { otpGateway } from "./gateways/otp";
import { erpGateway } from "./gateways/erp";
import {
  User as SelectUser,
  USER_TYPES,
  adminPermissions,
  bookingConfirmations,
  bookings,
  messages,
  otpVerifications,
  payments,
  pricingHistory,
  reviews,
  users,
} from "@shared/schema";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { randomInt, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { z } from "zod";

const scryptAsync = promisify(scrypt);

const otpRequestSchema = z.object({
  phone: z.string().min(8).max(30),
  fullName: z.string().min(1).max(160).optional(),
});

const otpVerifySchema = z.object({
  phone: z.string().min(8).max(30),
  code: z.string().regex(/^\d{4,8}$/),
  fullName: z.string().min(1).max(160).optional(),
  password: z.string().min(6).max(120).optional(),
});

const mobileSignupRequestSchema = z.object({
  phone: z.string().min(8).max(30),
  fullName: z.string().min(1).max(160),
  password: z.string().min(6).max(120),
});

const mobileSignupVerifySchema = z.object({
  phone: z.string().min(8).max(30),
  fullName: z.string().min(1).max(160),
  password: z.string().min(6).max(120),
  code: z.string().regex(/^\d{4,8}$/),
});

const mobileLoginSchema = z.object({
  phone: z.string().min(8).max(30),
  password: z.string().min(1).max(120),
});

const mobilePasswordResetRequestSchema = z.object({
  phone: z.string().min(8).max(30),
});

const mobilePasswordResetVerifySchema = z.object({
  phone: z.string().min(8).max(30),
  code: z.string().regex(/^\d{4,8}$/),
  password: z.string().min(6).max(120),
});

function normalizeSaudiPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("9665") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("05") && digits.length === 10) return `+966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `+966${digits}`;
  throw new Error("Enter a valid Saudi mobile number");
}

function phoneLookupCandidates(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return Array.from(new Set([
    phone,
    `+${digits}`,
    digits,
    digits.startsWith("966") ? `0${digits.slice(3)}` : digits,
  ].filter(Boolean)));
}

async function getUserByAnyPhoneFormat(phone: string) {
  for (const candidate of phoneLookupCandidates(phone)) {
    const user = await storage.getUserByPhone(candidate);
    if (user) return user;
  }
  return undefined;
}

async function buildUniqueClientUsername(phone: string) {
  const suffix = phone.replace(/\D/g, "");
  const baseUsername = `client_${suffix}`;
  let username = baseUsername;
  let counter = 1;

  while (await storage.getUserByUsername(username)) {
    counter += 1;
    username = `${baseUsername}_${counter}`;
  }

  return username;
}

function customerExternalId(userId: number) {
  return `user_${userId}`;
}

function leadExternalId(userId: number) {
  return `lead_user_${userId}`;
}

async function syncMobileClientSignupToErp(user: SelectUser) {
  try {
    const customer = await erpGateway.upsertCustomer({
      externalId: customerExternalId(user.id),
      name: user.fullName || user.username,
      mobile: user.phone,
      email: user.email,
      metadata: {
        source: "saneea_mobile_signup",
        userId: user.id,
        username: user.username,
        phoneVerifiedAt: user.phoneVerifiedAt,
        createdAt: user.createdAt,
      },
    });

    if (customer.status === "failed") {
      console.error("ERP signup customer sync failed:", customer);
    }

    const lead = await erpGateway.createLead({
      externalId: leadExternalId(user.id),
      name: user.fullName || user.username,
      mobile: user.phone,
      email: user.email,
      source: "saneea_mobile_signup",
      metadata: {
        userId: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    });

    if (lead.status === "failed") {
      console.error("ERP signup lead sync failed:", lead);
    }
  } catch (error) {
    console.error("ERP signup sync failed:", error);
  }
}

function generateOtpCode() {
  return randomInt(100000, 999999).toString();
}

function isAuthenticaOtpEnabled() {
  return process.env.OTP_PROVIDER === "authentica";
}

async function hashOtp(code: string) {
  const salt = process.env.OTP_SECRET || "saneea-local-otp-secret";
  const buf = (await scryptAsync(code, salt, 32)) as Buffer;
  return buf.toString("hex");
}

async function compareOtp(code: string, hash: string) {
  const supplied = Buffer.from(await hashOtp(code), "hex");
  const stored = Buffer.from(hash, "hex");
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}

function publicUser(user: SelectUser) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function jwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || "saneea-local-jwt-secret";
}

export function createMobileAuthToken(user: SelectUser) {
  return jwt.sign(
    {
      sub: String(user.id),
      userId: user.id,
      userType: user.userType,
    },
    jwtSecret(),
    { expiresIn: "30d" }
  );
}

export async function getMobileUserFromRequest(req: any) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    try {
      const parsed = jwt.verify(token, jwtSecret()) as jwt.JwtPayload & { userId?: number };
      const userId = parsed.userId || Number(parsed.sub);
      if (!userId) return null;
      return await storage.getUser(userId);
    } catch {
      return null;
    }
  }

  return null;
}

async function getJwtUserFromRequest(req: any) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  try {
    const parsed = jwt.verify(token, jwtSecret()) as jwt.JwtPayload & { userId?: number };
    const userId = parsed.userId || Number(parsed.sub);
    if (!userId) return null;
    return await storage.getUser(userId);
  } catch {
    return null;
  }
}

async function issueSignupOtp(input: { phone: string }) {
  const phone = normalizeSaudiPhone(input.phone);
  const code = isAuthenticaOtpEnabled() ? undefined : generateOtpCode();
  const codeHash = code ? await hashOtp(code) : "external";
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const existingUser = await getUserByAnyPhoneFormat(phone);
  if (existingUser) {
    throw new Error("This phone number is already registered. Please log in with your password.");
  }

  const result = await otpGateway.sendOtp({
    phone,
    code,
    purpose: "mobile_signup",
  });

  await db.insert(otpVerifications).values({
    phone,
    purpose: "mobile_signup",
    codeHash,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    expiresAt,
  });

  return {
    phone,
    expiresInSeconds: 300,
    provider: result.provider,
    devCode: result.devCode,
  };
}

async function issuePasswordResetOtp(input: { phone: string }) {
  const phone = normalizeSaudiPhone(input.phone);
  const existingUser = await getUserByAnyPhoneFormat(phone);
  if (!existingUser || existingUser.userType !== USER_TYPES.CLIENT) {
    throw new Error("No client account found for this phone number.");
  }

  const code = isAuthenticaOtpEnabled() ? undefined : generateOtpCode();
  const codeHash = code ? await hashOtp(code) : "external";
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const result = await otpGateway.sendOtp({
    phone,
    code,
    purpose: "mobile_password_reset",
  });

  await db.insert(otpVerifications).values({
    phone,
    purpose: "mobile_password_reset",
    codeHash,
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    expiresAt,
  });

  return {
    phone,
    expiresInSeconds: 300,
    provider: result.provider,
    devCode: result.devCode,
  };
}

async function consumeOtp(phone: string, code: string, purpose: "mobile_signup" | "mobile_password_reset") {
  const [otp] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.consumedAt),
      )
    )
    .orderBy(desc(otpVerifications.createdAt))
    .limit(1);

  if (!otp) throw new Error("OTP not found or already used");
  if (otp.expiresAt.getTime() < Date.now()) throw new Error("OTP expired");
  if ((otp.attempts || 0) >= (otp.maxAttempts || 5)) throw new Error("Too many OTP attempts");

  const isValid = otp.provider === "authentica"
    ? (await otpGateway.verifyOtp({ phone, code, providerMessageId: otp.providerMessageId })).verified
    : await compareOtp(code, otp.codeHash);

  if (!isValid) {
    await db
      .update(otpVerifications)
      .set({ attempts: (otp.attempts || 0) + 1 })
      .where(eq(otpVerifications.id, otp.id));
    throw new Error("Invalid OTP code");
  }

  await db
    .update(otpVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(otpVerifications.id, otp.id));
}

async function consumeSignupOtp(phone: string, code: string) {
  await consumeOtp(phone, code, "mobile_signup");
}

async function consumePasswordResetOtp(phone: string, code: string) {
  await consumeOtp(phone, code, "mobile_password_reset");
}

async function deleteClientAccount(user: SelectUser) {
  const userBookings = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.clientId, user.id));
  const bookingIds = userBookings.map((booking) => booking.id);

  await db.transaction(async (tx) => {
    if (bookingIds.length > 0) {
      await tx.delete(payments).where(inArray(payments.bookingId, bookingIds));
      await tx.delete(pricingHistory).where(inArray(pricingHistory.bookingId, bookingIds));
      await tx.delete(bookingConfirmations).where(inArray(bookingConfirmations.bookingId, bookingIds));
      await tx.delete(reviews).where(or(eq(reviews.clientId, user.id), inArray(reviews.bookingId, bookingIds)));
      await tx.delete(bookings).where(inArray(bookings.id, bookingIds));
    } else {
      await tx.delete(reviews).where(eq(reviews.clientId, user.id));
    }

    await tx.delete(messages).where(or(eq(messages.senderId, user.id), eq(messages.receiverId, user.id)));
    await tx.delete(otpVerifications).where(eq(otpVerifications.phone, user.phone || ""));
    await tx.delete(adminPermissions).where(eq(adminPermissions.userId, user.id));
    await tx.delete(users).where(eq(users.id, user.id));
  });
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      user: SelectUser;
      isAuthenticated(): boolean;
      login(user: SelectUser, done: (err?: unknown) => void): void;
      logout(done: (err?: unknown) => void): void;
    }
  }
}

export function setupAuth(app: Express) {
  app.set("trust proxy", 1);

  app.use(async (req: any, _res, next) => {
    const user = await getJwtUserFromRequest(req);
    if (user) req.user = user;
    req.isAuthenticated = () => Boolean(req.user);
    req.login = (_user: SelectUser, done: (err?: unknown) => void) => done();
    req.logout = (done: (err?: unknown) => void) => {
      req.user = undefined;
      done();
    };
    next();
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { email, username } = req.body;
      
      // Check if user already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: "Email already in use" });
      }
      
      const existingUserByUsername = await storage.getUserByUsername(username);
      if (existingUserByUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create the user
      const user = await storage.createUser(req.body);
      
      // If user is a vendor, create vendor profile
      if (user.userType === USER_TYPES.VENDOR && req.body.businessName) {
        await storage.createVendor({
          userId: user.id,
          businessName: req.body.businessName,
          category: req.body.category || 'other',
          description: req.body.description || '',
          address: req.body.address,
          city: req.body.city,
          priceRange: req.body.priceRange,
          capacity: req.body.capacity,
          amenities: req.body.amenities || [],
          features: req.body.features || [],
          photos: req.body.photos || []
        });
      }
      
      res.status(201).json({
        ...publicUser(user),
        token: createMobileAuthToken(user),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/mobile/auth/request-otp", async (req, res, next) => {
    try {
      const input = mobileSignupRequestSchema.parse(req.body);
      res.status(201).json(await issueSignupOtp(input));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid OTP request", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/signup/request-otp", async (req, res, next) => {
    try {
      const input = mobileSignupRequestSchema.parse(req.body);
      res.status(201).json(await issueSignupOtp(input));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid signup request", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/verify-otp", async (req, res, next) => {
    try {
      const input = mobileSignupVerifySchema.parse(req.body);
      const phone = normalizeSaudiPhone(input.phone);
      await consumeSignupOtp(phone, input.code);

      const existingUser = await getUserByAnyPhoneFormat(phone);
      if (existingUser) {
        return res.status(400).json({ message: "This phone number is already registered. Please log in." });
      }

      const suffix = phone.replace(/\D/g, "");
      const username = await buildUniqueClientUsername(phone);
      const user = await storage.createUser({
        username,
        email: `${suffix}@mobile.saneea.local`,
        password: input.password,
        fullName: input.fullName,
        phone,
        phoneVerifiedAt: new Date(),
        userType: USER_TYPES.CLIENT,
        avatarUrl: null,
      });

      syncMobileClientSignupToErp(user).catch((error) => {
        console.error("ERP signup sync failed:", error);
      });

      res.status(200).json({
        ...publicUser(user),
        user: publicUser(user),
        token: createMobileAuthToken(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid OTP verification", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/signup/verify-otp", async (req, res, next) => {
    try {
      const input = mobileSignupVerifySchema.parse(req.body);
      const phone = normalizeSaudiPhone(input.phone);
      await consumeSignupOtp(phone, input.code);

      const existingUser = await getUserByAnyPhoneFormat(phone);
      if (existingUser) {
        return res.status(400).json({ message: "This phone number is already registered. Please log in." });
      }

      const suffix = phone.replace(/\D/g, "");
      const username = await buildUniqueClientUsername(phone);
      const user = await storage.createUser({
        username,
        email: `${suffix}@mobile.saneea.local`,
        password: input.password,
        fullName: input.fullName,
        phone,
        phoneVerifiedAt: new Date(),
        userType: USER_TYPES.CLIENT,
        avatarUrl: null,
      });

      syncMobileClientSignupToErp(user).catch((error) => {
        console.error("ERP signup sync failed:", error);
      });

      res.status(201).json({
        ...publicUser(user),
        user: publicUser(user),
        token: createMobileAuthToken(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid signup verification", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/login", async (req, res, next) => {
    try {
      const input = mobileLoginSchema.parse(req.body);
      const phone = normalizeSaudiPhone(input.phone);
      const user = await getUserByAnyPhoneFormat(phone);

      if (!user || user.userType !== USER_TYPES.CLIENT) {
        return res.status(401).json({ message: "Invalid phone number or password" });
      }

      const isValid = await storage.verifyPassword(input.password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid phone number or password" });
      }

      res.status(200).json({
        ...publicUser(user),
        user: publicUser(user),
        token: createMobileAuthToken(user),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid login request", errors: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/password-reset/request-otp", async (req, res, next) => {
    try {
      const input = mobilePasswordResetRequestSchema.parse(req.body);
      res.status(201).json(await issuePasswordResetOtp(input));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid password reset request", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.post("/api/mobile/auth/password-reset/verify-otp", async (req, res, next) => {
    try {
      const input = mobilePasswordResetVerifySchema.parse(req.body);
      const phone = normalizeSaudiPhone(input.phone);
      const user = await getUserByAnyPhoneFormat(phone);

      if (!user || user.userType !== USER_TYPES.CLIENT) {
        return res.status(404).json({ message: "No client account found for this phone number." });
      }

      await consumePasswordResetOtp(phone, input.code);
      const updatedUser = await storage.updateUserPassword(user.id, input.password);
      if (!updatedUser) return res.status(404).json({ message: "User not found" });

      res.status(200).json({
        ...publicUser(updatedUser),
        user: publicUser(updatedUser),
        token: createMobileAuthToken(updatedUser),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid password reset verification", errors: error.errors });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  });

  app.delete("/api/mobile/account", async (req, res, next) => {
    try {
      const user = await getMobileUserFromRequest(req);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.userType !== USER_TYPES.CLIENT) return res.status(403).json({ message: "Client account required" });

      await deleteClientAccount(user);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting mobile account:", error);
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const loginId = String(username || "").trim();
      let user: SelectUser | undefined;

      try {
        const phone = normalizeSaudiPhone(loginId);
        user = await getUserByAnyPhoneFormat(phone);
      } catch {
        user = await getUserByAnyPhoneFormat(loginId);
      }

      if (!user) {
        const isEmail = loginId.includes("@");
        user = isEmail
          ? await storage.getUserByEmail(loginId)
          : await storage.getUserByUsername(loginId);
      }

      if (!user) return res.status(401).json({ message: "Incorrect phone number, username, or email" });

      const isValid = await storage.verifyPassword(password, user.password);
      if (!isValid) return res.status(401).json({ message: "Incorrect password" });

      res.status(200).json({
        ...publicUser(user),
        token: createMobileAuthToken(user),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/logout", (_req, res) => {
    res.sendStatus(200);
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Return user without password
    res.json(publicUser(req.user));
  });
}
