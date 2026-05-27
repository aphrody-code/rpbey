import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, twoFactor, username } from "better-auth/plugins";
import { db, schema } from "@/lib/db";

const isProduction = process.env.NODE_ENV === "production";
const baseURL =
	process.env.BETTER_AUTH_URL ||
	process.env.NEXT_PUBLIC_APP_URL ||
	(isProduction ? "https://rpbey.fr" : "http://localhost:3000");

export const auth = betterAuth({
	baseURL,
	trustHost: true,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
	}),

	plugins: [
		admin({
			defaultRole: "user",
			adminRoles: ["admin"],
		}),
		username(),
		twoFactor({
			issuer: "RPB Dashboard",
		}),
		// nextCookies() OBLIGATOIRE Next.js — propage Set-Cookie depuis server actions.
		// DOIT être le DERNIER plugin (Better Auth doc).
		nextCookies(),
	],

	// Email & Password authentication
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false, // Set to true in production
	},

	// Session configuration
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},

	// Social providers (Discord OAuth)
	socialProviders: {
		discord: {
			clientId: process.env.DISCORD_CLIENT_ID || "",
			clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
			mapProfileToUser: (profile) => {
				return {
					name: profile.username, // Force username instead of display name
					discordId: profile.id,
					discordTag:
						profile.discriminator === "0"
							? profile.username
							: `${profile.username}#${profile.discriminator}`,
					image: `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`,
					globalName: profile.global_name,
				};
			},
		},
		twitch: {
			clientId: process.env.TWITCH_CLIENT_ID || "",
			clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
		},
		google: {
			clientId: process.env.GOOGLE_CLIENT_ID || "",
			clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
			scope: ["https://www.googleapis.com/auth/spreadsheets"],
		},
	},

	// Advanced configuration
	advanced: {
		useSecureCookies: true, // Force secure cookies for production behind proxy
		cookiePrefix: "rpb-auth",
	},

	// NOTE: `callbacks.session` (pattern next-auth) supprimé — Better Auth l'ignore silencieusement.
	// Le plugin `admin({ adminRoles })` ajouté ci-dessus expose déjà `role` dans la session
	// via `session.user.role`. Pas besoin de mapper manuellement.

	// Trusted origins
	trustedOrigins: [
		baseURL,
		"https://rpbey.fr",
		"http://localhost:3000",
		"http://localhost:8000",
		"rpb-tcg://",
	],
});

export type Session = typeof auth.$Infer.Session;
export type User = (typeof auth.$Infer.Session)["user"];
