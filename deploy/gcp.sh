#!/usr/bin/env bash
# Deploy the Cuba prototype to Cloud Run in Singapore (asia-southeast1) and map cuba.reboo8.com.
# Usage:  ./deploy/gcp.sh              (uses VITE_GROQ_API_KEY from the environment or ./.env if present)
#         PROJECT=reboo8prod ./deploy/gcp.sh
# Re-run any time: every step is idempotent. Needs: gcloud auth login (owner/editor on the project).
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
[[ -n "$PROJECT" ]] || { echo "! no project — run: gcloud config set project reboo8prod"; exit 1; }
REGION="${REGION:-asia-southeast1}"
REPO="${REPO:-cuba}"
SERVICE="${SERVICE:-cuba-prototype}"
DOMAIN="${DOMAIN:-cuba.reboo8.com}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}"
STAGING="gs://${PROJECT}-cloudbuild-${REGION}"

# Groq key (optional): environment wins, else read from .env. Without it the app runs on its built-in fallbacks.
# The key ends up in the public JS bundle by design (browser → Groq), so it is passed as a plain build substitution.
if [[ -z "${VITE_GROQ_API_KEY:-}" && -f .env ]]; then
  VITE_GROQ_API_KEY="$( { grep -E '^VITE_GROQ_API_KEY=' .env || true; } | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
VITE_GROQ_API_KEY="${VITE_GROQ_API_KEY:-}"

echo "▶ project=${PROJECT} region=${REGION} service=${SERVICE} domain=${DOMAIN} groq_key=$([[ -n "$VITE_GROQ_API_KEY" ]] && echo set || echo none)"

echo "▶ enabling APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$PROJECT" --quiet

echo "▶ build service account permissions"
BUILD_SA="$(gcloud builds get-default-service-account --region "$REGION" --project "$PROJECT" --format 'value(serviceAccountEmail)' 2>/dev/null || true)"
BUILD_SA="${BUILD_SA#projects/*/serviceAccounts/}"
if [[ -n "$BUILD_SA" ]]; then
  echo "  build SA: ${BUILD_SA}"
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${BUILD_SA}" --role roles/cloudbuild.builds.builder --condition None --quiet >/dev/null \
    || echo "  ! could not grant roles/cloudbuild.builds.builder — if the build fails on logs/registry access, grant it in IAM"
fi

echo "▶ artifact registry repo + cleanup policy (keep 5 newest, delete >30 days)"
gcloud artifacts repositories describe "$REPO" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" --repository-format docker --location "$REGION" --project "$PROJECT" --description "Cuba prototype images" --quiet
gcloud artifacts repositories set-cleanup-policies "$REPO" --location "$REGION" --project "$PROJECT" --policy deploy/ar-cleanup.json --quiet >/dev/null \
  || echo "  ! cleanup policy not applied (non-fatal)"

echo "▶ source staging bucket in ${REGION} (7-day lifecycle)"
gcloud storage buckets describe "$STAGING" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud storage buckets create "$STAGING" --location "$REGION" --project "$PROJECT" --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "$STAGING" --lifecycle-file deploy/gcs-lifecycle.json --project "$PROJECT" >/dev/null || true

echo "▶ building image in Cloud Build (${REGION})"
gcloud builds submit --config deploy/cloudbuild.yaml --project "$PROJECT" --region "$REGION" \
  --gcs-source-staging-dir "${STAGING}/source" \
  --substitutions "_REGION=${REGION},_REPO=${REPO},_SERVICE=${SERVICE},_VITE_GROQ_API_KEY=${VITE_GROQ_API_KEY}" --quiet

echo "▶ deploying to Cloud Run"
gcloud run deploy "$SERVICE" --image "${IMAGE}:latest" --region "$REGION" --project "$PROJECT" \
  --platform managed --allow-unauthenticated --port 8080 \
  --memory 256Mi --cpu 1 --min-instances 0 --max-instances 3 --concurrency 200 --quiet

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format 'value(status.url)')"
probe() { curl -sS -o /dev/null --max-time 30 -w '%{http_code}' "${URL}/healthz" || echo 000; }
code="$(probe)"
if [[ "$code" != "200" ]]; then
  echo "  public access not active yet (HTTP ${code}) — an org policy may block allUsers; switching off the invoker IAM check"
  gcloud run services update "$SERVICE" --region "$REGION" --project "$PROJECT" --no-invoker-iam-check --quiet || true
  sleep 5; code="$(probe)"
fi
if [[ "$code" != "200" ]]; then
  echo "! ${URL}/healthz returned HTTP ${code}. The service is deployed but not publicly reachable."
  echo "  Most likely cause: org policy iam.allowedPolicyMemberDomains (Domain Restricted Sharing). An Org Policy Administrator must allow allUsers on project ${PROJECT}."
  exit 1
fi
echo "✓ service is live: ${URL}"

echo "▶ domain mapping ${DOMAIN}"
if gcloud beta run domain-mappings describe --domain "$DOMAIN" --region "$REGION" --project "$PROJECT" >/dev/null 2>&1; then
  echo "  mapping exists"
else
  gcloud beta run domain-mappings create --service "$SERVICE" --domain "$DOMAIN" --region "$REGION" --project "$PROJECT" --quiet || {
    echo "! ${DOMAIN} is NOT mapped. The service is still live at ${URL}."
    echo "  Verify reboo8.com for the active gcloud account first:  gcloud domains verify reboo8.com  (Search Console → TXT record at the DNS provider), then re-run this script."
    exit 1
  }
fi
echo "▶ DNS records to add at the reboo8.com DNS provider (Hostinger):"
gcloud beta run domain-mappings describe --domain "$DOMAIN" --region "$REGION" --project "$PROJECT" \
  --format 'table(status.resourceRecords[].name,status.resourceRecords[].type,status.resourceRecords[].rrdata)'
echo "Done. https://${DOMAIN} goes live once the CNAME resolves and Google issues the certificate (usually 15–60 min)."
