-- Tables Agent Auth Protocol (@better-auth/agent-auth) — additif, non-destructif.
-- Gérées par better-auth (drizzleAdapter, usePlural) → timestamps en mode date.
-- Colonnes camelCase (convention better-auth + reste du schéma).

CREATE TABLE IF NOT EXISTS "agent_hosts" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "userId" text,
  "defaultCapabilities" text,
  "publicKey" text,
  "kid" text,
  "jwksUrl" text,
  "enrollmentTokenHash" text,
  "enrollmentTokenExpiresAt" timestamp(3),
  "status" text NOT NULL,
  "activatedAt" timestamp(3),
  "expiresAt" timestamp(3),
  "lastUsedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_hosts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_hosts_userId_idx" ON "agent_hosts" USING btree ("userId");

CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "userId" text,
  "hostId" text NOT NULL,
  "status" text NOT NULL,
  "mode" text NOT NULL,
  "publicKey" text NOT NULL,
  "kid" text,
  "jwksUrl" text,
  "lastUsedAt" timestamp(3),
  "activatedAt" timestamp(3),
  "expiresAt" timestamp(3),
  "metadata" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "agents_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "agent_hosts"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "agents_userId_idx" ON "agents" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "agents_hostId_idx" ON "agents" USING btree ("hostId");

CREATE TABLE IF NOT EXISTS "agent_capability_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "agentId" text NOT NULL,
  "capability" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "constraints" text,
  "deniedBy" text,
  "grantedBy" text,
  "expiresAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_capability_grants_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "agent_capability_grants_deniedBy_fkey" FOREIGN KEY ("deniedBy") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "agent_capability_grants_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "agent_capability_grants_agentId_idx" ON "agent_capability_grants" USING btree ("agentId");

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" text PRIMARY KEY NOT NULL,
  "method" text NOT NULL,
  "agentId" text,
  "hostId" text,
  "userId" text,
  "capabilities" text,
  "status" text NOT NULL,
  "userCodeHash" text,
  "loginHint" text,
  "bindingMessage" text,
  "clientNotificationToken" text,
  "clientNotificationEndpoint" text,
  "deliveryMode" text,
  "interval" integer NOT NULL,
  "lastPolledAt" timestamp(3),
  "expiresAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_requests_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "approval_requests_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "agent_hosts"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT "approval_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "approval_requests_userId_idx" ON "approval_requests" USING btree ("userId");
CREATE INDEX IF NOT EXISTS "approval_requests_agentId_idx" ON "approval_requests" USING btree ("agentId");
