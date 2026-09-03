# Deploying Cuba to Google Cloud (Singapore)

Target: Cloud Run service `cuba` in `asia-southeast1`, image built by Cloud Build into Artifact Registry repo `cuba`, mapped to **cuba.reboo8.com**.

```
gcloud auth login                 # once per session (admin@reboo8.com, project reboo8prod)
./deploy/gcp.sh                   # build + deploy + domain mapping; safe to re-run
VITE_GROQ_API_KEY=gsk_... ./deploy/gcp.sh   # rebuild with a Groq key baked into the bundle
```

The script enables the APIs, creates the registry repo if missing, builds `Dockerfile` (Vite build → nginx:alpine, port 8080), deploys with 0–3 instances / 256 MiB, builds in a Singapore staging bucket, keeps only the 5 newest images, then creates the domain mapping and prints the DNS records to add at the reboo8.com DNS provider (Hostinger): a `CNAME cuba → ghs.googlehosted.com`. Google issues the certificate automatically once the CNAME resolves.

Files: `Dockerfile`, `deploy/nginx.conf` (gzip, immutable cache for `/assets`, no-cache app shell, `/healthz`), `deploy/cloudbuild.yaml`, `.gcloudignore` / `.dockerignore` (keep `.env`, `node_modules`, `dist` out of uploads and images).
