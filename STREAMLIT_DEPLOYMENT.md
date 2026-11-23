# ArtFlow AI – Streamlit edition

This folder contains the Python/Streamlit edition of the ArtFlow AI – Klaviyo Growth Intelligence portfolio prototype.

## Deploy free on Streamlit Community Cloud

1. Push this repository/branch to GitHub.
2. Sign in at https://share.streamlit.io/ with GitHub.
3. Choose **New app**.
4. Repository: `sghatge/klaviyo-growth-intelligence`
5. Branch: `streamlit-migration`
6. Main file path: `streamlit/app.py`
7. Deploy. The Community Cloud free tier is intended for small public demos; availability and resource limits are controlled by Streamlit.

## Optional Streamlit secrets

Add these in the app's **Settings → Secrets**. Never commit real keys.

```toml
KLAVIYO_PRIVATE_API_KEY = "your-restricted-read-only-private-key"
KLAVIYO_API_REVISION = "2026-10-15"
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_ANON_KEY = "your-anon-or-publishable-key"
GEMINI_API_KEY = "your-gemini-api-key"
OPENAI_API_KEY = "your-openai-api-key"
```

- Without keys, the application runs with synthetic demo data and deterministic assistant responses.
- Klaviyo integration is read-only. It retrieves flows, campaigns and profiles. Do not use a broad-scope private key.
- Gemini powers the assistant when configured; otherwise the local fallback is used.
- Audio recording is available in Talk to ArtFlow. Transcription requires an OpenAI API key.
- The app does not send campaigns, activate flows, update profiles or write events.
- All built-in customers and revenue values are synthetic.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r streamlit/requirements.txt
streamlit run streamlit/app.py
```

## Included workspaces

Overview · Abandoned cart simulator · Campaign studio · Lifecycle flows · Customers · AI QA · Integrations · Talk to ArtFlow.
