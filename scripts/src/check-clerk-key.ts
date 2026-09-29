const key = process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
const nodeEnv = process.env.NODE_ENV ?? "";
const vercelEnv = process.env.VERCEL_ENV ?? "";

if (nodeEnv !== "production") {
  process.exit(0);
}

const isVercelPreview = vercelEnv === "preview";

if (!key) {
  console.error(
    "❌  VITE_CLERK_PUBLISHABLE_KEY is not set.\n" +
      "    Set it to a production key (pk_live_…) in your Vercel project environment variables.",
  );
  process.exit(1);
}

if (key.startsWith("pk_test_")) {
  // Vercel Preview deployments cannot authenticate with a domain-locked
  // production key, so a development key is the supported configuration there.
  if (isVercelPreview) {
    console.log(
      "✅  Vercel Preview build: development Clerk key (pk_test_…) accepted for preview deployments.",
    );
    process.exit(0);
  }
  console.error(
    "❌  VITE_CLERK_PUBLISHABLE_KEY is a development key (pk_test_…).\n" +
      "    Production builds require a live key starting with pk_live_.\n" +
      "    Find it in Clerk Dashboard → API Keys and update your Vercel environment variables.",
  );
  process.exit(1);
}

if (!key.startsWith("pk_live_")) {
  console.error(
    `❌  VITE_CLERK_PUBLISHABLE_KEY has an unrecognised prefix: "${key.slice(0, 12)}…"\n` +
      "    Expected a production key starting with pk_live_.",
  );
  process.exit(1);
}

console.log("✅  VITE_CLERK_PUBLISHABLE_KEY looks like a valid production Clerk key.");
