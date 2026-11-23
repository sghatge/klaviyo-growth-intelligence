# Klaviyo Growth Intelligence — ArtFlow AI

An interview portfolio project by Sangram Ghatge: a D2C lifecycle marketing workspace for a fictional custom portrait and artwork store.

## What it demonstrates
- Klaviyo-style lifecycle flows: welcome, abandoned cart, browse abandonment, post-purchase, win-back and review request.
- AI-assisted campaign copy generation through Vercel AI Gateway, with a clearly labelled demo fallback.
- Customer segmentation and read-only Klaviyo profile integration.
- Campaign QA checklist with mandatory human approval.
- Supabase-backed synthetic demo customer, flow and campaign data protected by RLS.
- Read-only Klaviyo API endpoints for account status, profiles and flows.

## Stack
Next.js App Router, TypeScript, Vercel, Supabase Postgres, Klaviyo REST API and optional Vercel AI Gateway.

## Run locally
1. Install Node.js 20.9+.
2. Copy .env.example to .env.local and set the Supabase URL and publishable key.
3. Add a restricted Klaviyo private API key only when you have your own test account.
4. Run npm install, then npm run dev.

## Environment variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- KLAVIYO_PRIVATE_API_KEY (server-side only; read-only scopes recommended)
- KLAVIYO_API_REVISION
- AI_GATEWAY_API_KEY (optional; server-side only)
- AI_GATEWAY_MODEL (optional)

## Safety and demo integrity
All sample customer records and revenue figures are synthetic. The application does not send campaigns, activate flows, or change live Klaviyo data. Use a dedicated Klaviyo test account and a custom private key with only the scopes needed for read operations. Never expose private keys through NEXT_PUBLIC variables or commit secrets.

## Supabase
The project database has tables for customer_profiles, campaign_briefs, lifecycle_flows, qa_runs and campaign_metrics. Synthetic demo rows are readable under RLS; anonymous writes are not granted.

## Portfolio walkthrough
1. Explain the lifecycle flows and triggers.
2. Generate campaign content for a selected segment.
3. Review customer profile and behavioral properties.
4. Run the pre-send QA checklist.
5. Demonstrate the read-only Klaviyo connection and Supabase integration.

This project demonstrates practical Klaviyo learning and transferable CRM/marketing automation skills; it is not a claim of prior years of professional Klaviyo platform experience.
