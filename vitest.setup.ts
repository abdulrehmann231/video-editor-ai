/**
 * Unit tests must not depend on real credentials.
 *
 * `getEnv()` validates the whole schema at once, so a test that only cares about
 * (say) GEMINI_API_KEYS still blows up on missing R2/Pexels vars. Seed inert
 * placeholders for everything the schema requires so the suite is hermetic and
 * passes in CI with no secrets configured.
 *
 * Anything already present in the environment wins, so exporting a real value
 * before `npm test` still works for a one-off live check.
 */
const PLACEHOLDERS: Record<string, string> = {
  R2_ENDPOINT: 'https://test-account.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'test-access-key-id',
  R2_SECRET_ACCESS_KEY: 'test-secret-access-key',
  R2_BUCKET: 'edit-ai-test',
  R2_PUBLIC_HOST: 'videos.test.invalid',
  GEMINI_API_KEYS: 'test-key-1,test-key-2',
  GEMINI_MODEL: 'gemini-flash-latest',
  PEXEL_API_KEY: 'test-pexels-key',
};

for (const [key, value] of Object.entries(PLACEHOLDERS)) {
  if (!process.env[key]) process.env[key] = value;
}
