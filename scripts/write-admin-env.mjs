// Reads a Firebase Admin service-account JSON and writes the FIREBASE_ADMIN_*
// lines into .env.local (replacing any existing ones). Run:
//   node scripts/write-admin-env.mjs sa.json
import { readFileSync, writeFileSync, existsSync } from "node:fs"

const jsonPath = process.argv[2] ?? "sa.json"
const envPath = ".env.local"

if (!existsSync(jsonPath)) {
  console.error(`Not found: ${jsonPath}`)
  process.exit(1)
}

const sa = JSON.parse(readFileSync(jsonPath, "utf8"))
for (const key of ["project_id", "client_email", "private_key"]) {
  if (!sa[key]) {
    console.error(`Missing "${key}" in ${jsonPath}`)
    process.exit(1)
  }
}

const lines = {
  FIREBASE_ADMIN_PROJECT_ID: sa.project_id,
  FIREBASE_ADMIN_CLIENT_EMAIL: sa.client_email,
  // store with escaped newlines on a single line
  FIREBASE_ADMIN_PRIVATE_KEY: `"${sa.private_key.replace(/\n/g, "\\n")}"`,
}

let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : ""
for (const [name, value] of Object.entries(lines)) {
  const line = `${name}=${value}`
  const re = new RegExp(`^${name}=.*$`, "m")
  env = re.test(env) ? env.replace(re, line) : `${env.trimEnd()}\n${line}\n`
}
writeFileSync(envPath, env.endsWith("\n") ? env : env + "\n")

console.log(`Wrote FIREBASE_ADMIN_* for project "${sa.project_id}" to ${envPath}`)
console.log(`\nNow delete the key file:  Remove-Item ${jsonPath}`)
