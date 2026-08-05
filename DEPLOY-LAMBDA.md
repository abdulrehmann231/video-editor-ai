# Fast rendering with Remotion Lambda (AWS)

Renders the motion-graphics on **AWS Lambda in parallel** — a 10-min video in
~1–3 minutes (vs 20–45 min locally), pennies per render, scales to many users.
Local rendering stays the default; set `RENDER_BACKEND=lambda` to switch.

## 1. AWS account
Sign up at https://aws.amazon.com (new accounts get free credits). A card is
required at signup; a virtual/prepaid card works.

## 2. Create an IAM user with the Remotion permissions
Remotion needs a specific IAM policy. Easiest path (from this project folder):
```bash
# print the exact policies Remotion needs
npx remotion lambda policies role
npx remotion lambda policies user
```
Then in the AWS Console → IAM:
1. **Policies → Create policy** → paste the *user* policy JSON → name it `remotion-user`.
2. **Roles → Create role** → paste the *role* policy → name it `remotion-lambda-role`
   (Remotion's function assumes this).
3. **Users → Create user** `remotion` → attach `remotion-user` → create an
   **access key** (type: application) → copy the key id + secret.

(For quick testing you can instead attach **AdministratorAccess** to the user —
simpler, less safe. Fine for a personal test account.)

## 3. Put AWS creds in `.env.local`
```
REMOTION_AWS_ACCESS_KEY_ID=<key id>
REMOTION_AWS_SECRET_ACCESS_KEY=<secret>
REMOTION_AWS_REGION=us-east-1
```

If your AWS account has a low Lambda concurrency limit while testing, you can
keep Remotion from spawning too many workers at once by adding:
```
REMOTION_MAX_LAMBDA_FUNCTIONS=10
```
or set a fixed shard size directly:
```
REMOTION_FRAMES_PER_LAMBDA=100
```

## 4. Deploy the function + composition site (one-time, and after UI changes)
```bash
npm run lambda:deploy
```
The deploy script now defaults the main Lambda timeout to 900 seconds. If you
still hit timeouts, set `REMOTION_LAMBDA_TIMEOUT_SECONDS` before deploying.
It prints values — add them to `.env.local`:
```
RENDER_BACKEND=lambda
REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-4-0-500-mem2048mb-disk4096mb-240sec
REMOTION_SERVE_URL=https://remotionlambda-…s3.amazonaws.com/sites/edit-ai/index.html
```
> Re-run `npm run lambda:deploy` whenever you change anything under
> `src/remotion/**` (it re-uploads the site). No need to redeploy the function
> unless you upgrade Remotion.

## 5. Render on Lambda
Restart the app (`npm run dev`) and hit **Re-edit** on a project. The final
render now runs on Lambda; everything else (upload, proxy, cut, music, R2) is
unchanged. Flip back anytime with `RENDER_BACKEND=local`.

If AWS still reports a rate-limit error, increase `REMOTION_FRAMES_PER_LAMBDA`
so each Lambda render job covers more frames, or request a higher concurrency
quota in AWS.

## Notes
- The Lambda pulls the base cut + b-roll from their public URLs (R2 custom domain
  + Pexels) — make sure those are reachable (they are by default).
- Cost: a 10-min 1080p render is a few US cents; new-account free credits cover a
  lot of testing. Check with `npx remotion lambda functions` / AWS billing.
- Region: keep the Lambda region close to you and to R2 for speed.
