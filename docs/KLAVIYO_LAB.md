# Klaviyo hands-on lab

Use a dedicated Klaviyo test account. Do not connect an employer or client production account.

## Read-only API connection
Create a custom private API key with only the scopes needed for:
- Account read
- Profiles read
- Flows read

Store it as KLAVIYO_PRIVATE_API_KEY in server-side environment variables. Never prefix it with NEXT_PUBLIC_.

## Practical exercises
1. Create a signup form and a Welcome Series flow. Confirm consent and suppression settings.
2. Build an Abandoned Cart flow triggered by Added to Cart; add purchase filters and exit conditions.
3. Build a Browse Abandonment flow with consent and eligibility filters.
4. Build a Post-Purchase flow with order confirmation, review request and cross-sell timing.
5. Create segments for first-time buyers, repeat buyers, high-value buyers and lapsed customers.
6. Draft a campaign for each segment and preview desktop/mobile rendering.
7. Run an A/B test on subject line or content; define a primary conversion metric before starting.
8. Review attributed revenue, conversion rate, revenue per recipient and deliverability.

## Interview talking points
- A flow is event-triggered automation; a campaign is a scheduled or one-off broadcast.
- Use event and profile properties for segmentation; define fallbacks for missing data.
- Use suppression and consent filters before every send.
- Optimize for orders and revenue, not opens alone.
- QA links, tracking, dynamic content, unsubscribe, mobile rendering and audience eligibility.
- Keep a human approval gate before activation or send.

## Honest scope
The portfolio UI includes synthetic demo flows and read-only API integration. It does not create, edit, activate or send Klaviyo campaigns or flows.
