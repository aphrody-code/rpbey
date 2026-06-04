import { readdir, stat, readFile } from "node:fs/promises";
import { join, resolve, extname } from "node:path";
import os from "node:os";

// Config & Paths
const REPO_ROOT = resolve(import.meta.dir, "..");
const WEB_SRC = join(REPO_ROOT, "apps/web/src");
const REPORT_PATH = "/home/ubuntu/.gemini/antigravity-cli/brain/6cd85547-15f7-47a8-bb5b-d00b11d384ae/serverless_audit_report.md";

interface AuditViolation {
  file: string;
  line: number;
  rule: string;
  snippet: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  details: string;
}

const violations: AuditViolation[] = [];
let filesScanned = 0;

async function walk(dir: string, callback: (filePath: string) => Promise<void>) {
  const files = await readdir(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      if (file !== "node_modules" && file !== ".next" && file !== ".turbo" && file !== ".git") {
        await walk(filePath, callback);
      }
    } else {
      const ext = extname(file);
      if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        await callback(filePath);
      }
    }
  }
}

async function auditFile(filePath: string) {
  const relativePath = filePath.replace(REPO_ROOT + "/", "");
  filesScanned++;
  const content = await readFile(filePath, "utf-8");
  const lines = content.split("\n");

  const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
  const isServerAction = content.includes('"use server"') || content.includes("'use server'");

  // Check client component leaks
  if (isClientComponent) {
    if (content.includes("@rpbey/db") || content.includes("@/lib/db") || content.includes("drizzle-orm")) {
      // Find line number
      lines.forEach((lineText, idx) => {
        if (lineText.includes("@rpbey/db") || lineText.includes("@/lib/db") || lineText.includes("drizzle-orm")) {
          violations.push({
            file: relativePath,
            line: idx + 1,
            rule: "CLIENT_DB_LEAK",
            snippet: lineText.trim(),
            severity: "HIGH",
            details: "Client components cannot directly import database logic or credentials, as it exposes secrets and causes bundling issues on the client."
          });
        }
      });
    }
  }

  // Iterate lines for code patterns
  lines.forEach((lineText, idx) => {
    const trimmed = lineText.trim();
    const lineNum = idx + 1;

    // 1. Filesystem writes
    if (
      (trimmed.includes("fs.writeFile") ||
        trimmed.includes("fs.writeFileSync") ||
        trimmed.includes("fs.appendFile") ||
        trimmed.includes("fs.appendFileSync") ||
        trimmed.includes("fs.createWriteStream") ||
        trimmed.includes("fs/promises")) &&
      !trimmed.includes("/tmp") &&
      !trimmed.includes("tmpdir") &&
      !trimmed.includes("os.tmpdir") &&
      !relativePath.startsWith("scripts/") // Ignore standalone local scripts
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "FORBIDDEN_FS_WRITE",
        snippet: trimmed,
        severity: "HIGH",
        details: "Vercel Serverless environment has a read-only filesystem except for /tmp. Ensure any write operation targets /tmp or os.tmpdir()."
      });
    }

    // 2. Hardcoded local addresses
    if (
      (trimmed.includes("localhost:") || trimmed.includes("127.0.0.1:") || trimmed.includes("51.77.147.152")) &&
      !trimmed.includes("allowedOrigins") &&
      !trimmed.includes("allowedDevOrigins") &&
      !trimmed.includes("NEXT_PUBLIC_APP_URL") &&
      !relativePath.startsWith("scripts/") &&
      !relativePath.includes("next.config")
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "HARDCODED_LOCAL_HOST",
        snippet: trimmed,
        severity: "MEDIUM",
        details: "Avoid hardcoding localhost, loopback addresses, or the legacy VPS IP in production runtime code. Use relative paths or environment variables."
      });
    }

    // 3. Systemd / VPS commands
    if (
      (trimmed.includes("systemctl") ||
        trimmed.includes("service rpb-") ||
        trimmed.includes("service nginx") ||
        trimmed.includes("pm2") ||
        trimmed.includes(".listen(8080)") ||
        trimmed.includes(".listen(3000)")) &&
      !relativePath.startsWith("scripts/") &&
      !relativePath.includes("next.config")
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "VPS_INFRA_LEFTOVER",
        snippet: trimmed,
        severity: "HIGH",
        details: "Systemd service commands (systemctl, pm2) or raw TCP listening bind attempts violate serverless abstractions. Serverless apps rely on environment-driven port bindings."
      });
    }

    // 4. Deprecated caching
    if (trimmed.includes("unstable_cache") && !relativePath.startsWith("scripts/")) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "DEPRECATED_CACHE",
        snippet: trimmed,
        severity: "LOW",
        details: "Next.js 16 deprecates unstable_cache. Consider migrating to the new 'use cache' directive."
      });
    }

    // 5. Challonge IP scraping without bxc
    if (
      trimmed.includes("challonge.com") &&
      (trimmed.includes("fetch(") || trimmed.includes("axios(")) &&
      !trimmed.includes("bxc") &&
      !trimmed.includes("rose-griffon/challonge") &&
      !relativePath.startsWith("scripts/")
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "DIRECT_CHALLONGE_FETCH",
        snippet: trimmed,
        severity: "HIGH",
        details: "Challonge SPA is Cloudflare-gated. Raw fetch/axios directly from serverless will result in 403 Forbidden. Scrapes must be routed via bxc browsers/proxies."
      });
    }

    // 6. DB Timestamp mode checks
    // Check if non-auth table usage gets new Date() (which evaluates to Date object, causing crash in string mode)
    if (
      (trimmed.includes("new Date()") || trimmed.includes("Date.now()")) &&
      (trimmed.includes("insert") || trimmed.includes("update") || trimmed.includes("values")) &&
      !trimmed.includes("users") &&
      !trimmed.includes("accounts") &&
      !trimmed.includes("sessions") &&
      !trimmed.includes("verifications") &&
      !trimmed.includes("twoFactors") &&
      !trimmed.includes("toISOString()") &&
      !trimmed.includes("Math.floor") &&
      !relativePath.startsWith("scripts/")
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "TIMESTAMP_MODE_MISMATCH",
        snippet: trimmed,
        severity: "HIGH",
        details: "Timestamp invariant violation: inserting a raw Date object into a non-auth table (string mode) will trigger a runtime error. Call .toISOString() on the Date object."
      });
    }

    // Check if auth table usage gets toISOString() (which evaluates to string, causing crash in date mode)
    if (
      trimmed.includes("toISOString()") &&
      (trimmed.includes("insert") || trimmed.includes("update") || trimmed.includes("values")) &&
      (trimmed.includes("users") ||
        trimmed.includes("accounts") ||
        trimmed.includes("sessions") ||
        trimmed.includes("verifications") ||
        trimmed.includes("twoFactors")) &&
      !relativePath.startsWith("scripts/")
    ) {
      violations.push({
        file: relativePath,
        line: lineNum,
        rule: "TIMESTAMP_MODE_MISMATCH",
        snippet: trimmed,
        severity: "HIGH",
        details: "Timestamp invariant violation: inserting an ISO string into an auth table (date mode) will trigger a runtime error. Pass a raw Date object."
      });
    }
  });
}

async function run() {
  console.log("=== Starting Serverless Compatibility Audit ===");
  console.log(`Scanning: ${WEB_SRC}`);

  await walk(WEB_SRC, auditFile);

  console.log(`Scan completed! Scanned ${filesScanned} files. Found ${violations.length} violations.`);

  // Write report
  const highViolations = violations.filter((v) => v.severity === "HIGH");
  const medViolations = violations.filter((v) => v.severity === "MEDIUM");
  const lowViolations = violations.filter((v) => v.severity === "LOW");

  let markdown = `# Serverless Compatibility Audit Report\n\n`;
  markdown += `Generated on: ${new Date().toISOString()}\n`;
  markdown += `Total files scanned: **${filesScanned}**\n`;
  markdown += `Total violations found: **${violations.length}**\n\n`;

  markdown += `## Summary of Violations\n`;
  markdown += `- 🔴 **HIGH SEVERITY**: ${highViolations.length}\n`;
  markdown += `- 🟡 **MEDIUM SEVERITY**: ${medViolations.length}\n`;
  markdown += `- 🟢 **LOW SEVERITY**: ${lowViolations.length}\n\n`;

  markdown += `## Violations List\n\n`;

  if (violations.length === 0) {
    markdown += `🎉 No serverless compatibility issues detected! The codebase is clean.\n`;
  } else {
    for (const v of violations) {
      const severityIcon = v.severity === "HIGH" ? "🔴 HIGH" : v.severity === "MEDIUM" ? "🟡 MEDIUM" : "🟢 LOW";
      markdown += `### [${severityIcon}] ${v.rule} in [${v.file}](file:///${join(REPO_ROOT, v.file)}#L${v.line})\n`;
      markdown += `**Line ${v.line}:**\n`;
      markdown += `\`\`\`typescript\n${v.snippet}\n\`\`\`\n`;
      markdown += `**Description:** ${v.details}\n\n`;
      markdown += `---\n\n`;
    }
  }

  await Bun.write(REPORT_PATH, markdown);
  console.log(`Report written to ${REPORT_PATH}`);
}

run().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
