# GitHub Actions → Cloud Run: one-time setup

`.github/workflows/deploy.yml` deploys to Cloud Run on every push to `master`,
authenticating via Workload Identity Federation (no service account key
files). It needs three GitHub repo secrets, which do **not** exist by
default after cloning/forking this repo — someone with GCP IAM admin rights
on the project has to create them once, per project.

If you ever see the workflow fail with:

```
Error: google-github-actions/auth failed with: the GitHub Action workflow
must specify exactly one of "workload_identity_provider" or "credentials_json"!
```

...it means these secrets were never set up (or the repo was migrated to a
new GCP project). Re-run the steps below.

## What gets created

- A dedicated service account, `github-deployer@<PROJECT>.iam.gserviceaccount.com`,
  used only by CI to run `make deploy` (`gcloud run deploy --source .`).
- A Workload Identity Pool + OIDC provider trusting GitHub's OIDC tokens,
  restricted by an attribute condition to **this exact repo**
  (`xinrongl/wedding-translator`) — no other repo can impersonate this
  service account, even within the same GitHub org.
- IAM roles on that service account, matching Google's documented
  requirements for source-based Cloud Run deploys:
  - `roles/run.admin`, `roles/artifactregistry.writer`,
    `roles/cloudbuild.builds.editor` (project level)
  - `roles/iam.serviceAccountUser` on the Cloud Run runtime service account
    (needed to attach/run-as it)
  - `roles/storage.admin` (project level) — `gcloud run deploy --source`
    calls `storage.buckets.list`, which only exists as a project-level
    permission; a bucket-scoped grant is not sufficient (verified by
    trial — the workflow fails with `storage.buckets.list` denied
    otherwise, even after granting `storage.objectAdmin`/`storage.admin`
    scoped to just the source-staging bucket).

## Commands

Run as a GCP project owner/IAM admin (`gcloud auth login` first):

```bash
set -euo pipefail
PROJECT="canvas-aviary-302803"
REPO="xinrongl/wedding-translator"
SA_NAME="github-deployer"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
POOL_ID="github-actions-pool"
PROVIDER_ID="github-actions-provider"

gcloud services enable sts.googleapis.com cloudresourcemanager.googleapis.com --project="$PROJECT"

gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT" \
    --display-name="GitHub Actions Deployer ($REPO CI/CD)"

for ROLE in roles/run.admin roles/artifactregistry.writer roles/cloudbuild.builds.editor roles/storage.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member="serviceAccount:${SA_EMAIL}" --role="$ROLE" --condition=None --quiet
done

COMPUTE_SA=$(gcloud iam service-accounts list --project="$PROJECT" \
  --filter="email~-compute@developer.gserviceaccount.com" --format="value(email)")
gcloud iam service-accounts add-iam-policy-binding "$COMPUTE_SA" \
  --project="$PROJECT" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" --condition=None --quiet

gcloud iam workload-identity-pools describe "$POOL_ID" --project="$PROJECT" --location=global >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools create "$POOL_ID" \
    --project="$PROJECT" --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --project="$PROJECT" --location=global --workload-identity-pool="$POOL_ID" >/dev/null 2>&1 || \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --project="$PROJECT" --location=global --workload-identity-pool="$POOL_ID" \
    --display-name="GitHub Actions OIDC" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
    --attribute-condition="assertion.repository == '${REPO}'" \
    --issuer-uri="https://token.actions.githubusercontent.com"

PROJECT_NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
WIF_PROVIDER="projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}" \
  --quiet

echo "WIF_PROVIDER=${WIF_PROVIDER}"
echo "SA_EMAIL=${SA_EMAIL}"
```

Then set the repo secrets (from the repo root, so `.env` is picked up for
`APP_ENV_FILE`):

```bash
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "<WIF_PROVIDER printed above>"
gh secret set GCP_SERVICE_ACCOUNT --body "<SA_EMAIL printed above>"
gh secret set APP_ENV_FILE < .env
```

`APP_ENV_FILE` also needs updating (same command) whenever `.env` changes —
e.g. after adding an email to `SPEAKER_ALLOWED_EMAILS` — since CI rebuilds
`.env` from this secret rather than reading your local file.

## Verifying it worked

```bash
gh workflow run "Deploy to Cloud Run" --ref <branch>
gh run watch <run-id> --exit-status
```
