import os
import json
import time
from datetime import datetime, timezone
from typing import Any

import pandas as pd
import plotly.express as px
import requests
import streamlit as st

st.set_page_config(
    page_title="ArtFlow AI – Klaviyo Growth Intelligence",
    page_icon="🎨",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------- Theme ----------
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap');
:root { --ink:#172033; --muted:#788196; --line:#e8eaf0; --violet:#7257e8; --violet2:#f0edff; --mint:#dff7ed; }
html, body, [class*="css"] { font-family:'DM Sans',sans-serif; }
.stApp { background:#f7f8fc; color:var(--ink); }
h1,h2,h3 { font-family:'Manrope',sans-serif !important; letter-spacing:-.035em; }
.block-container { padding-top:1.6rem; padding-bottom:3rem; max-width:1500px; }
[data-testid="stSidebar"] { background:#fff; border-right:1px solid var(--line); }
[data-testid="stSidebar"] h1 { font-size:1.3rem; }
.brand { display:flex; align-items:center; gap:12px; padding:6px 0 22px; }
.brandmark { width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#8068f2,#a98cff);display:grid;place-items:center;color:white;font-size:22px; }
.brandname { font:800 22px Manrope,sans-serif; letter-spacing:-1px; color:#20243a; }
.brandname span { color:#8267ed; }
.brandtag { color:#9399aa;font-size:9px;letter-spacing:1.6px;font-weight:700; }
.workspace { background:#f7f7fb;border:1px solid var(--line);border-radius:13px;padding:12px;margin:4px 0 20px; }
.eyebrow { color:#858ba0;font-size:10px;font-weight:700;letter-spacing:1.4px; }
.page-intro { color:#788196;font-size:14px;margin-top:-8px;margin-bottom:24px; }
.kpi { background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;min-height:115px; }
.kpi-label { color:#7c8497;font-size:12px;font-weight:600; }
.kpi-value { font:800 27px Manrope,sans-serif;color:#20243a;margin-top:8px; }
.kpi-note { color:#9299aa;font-size:11px;margin-top:2px; }
.panel { background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px 20px;margin-bottom:14px; }
.panel-title { font:700 15px Manrope,sans-serif;margin-bottom:3px; }
.panel-sub { color:#8b92a4;font-size:11px;margin-bottom:14px; }
.pill { display:inline-block;border-radius:999px;padding:5px 10px;background:#f0edff;color:#7058db;font-size:10px;font-weight:700;letter-spacing:.5px; }
.pill-green { background:#e5f8ef;color:#23875c; }
.pill-gray { background:#eef0f5;color:#737c90; }
.small-muted { color:#8b92a4;font-size:11px; }
div.stButton > button { border-radius:10px; font-weight:600; }
div[data-testid="stMetric"] { background:white;border:1px solid var(--line);padding:14px 16px;border-radius:14px; }
div[data-testid="stDataFrame"] { border:1px solid var(--line);border-radius:12px;overflow:hidden; }
.stTabs [data-baseweb="tab-list"] { gap:8px; }
.stTabs [data-baseweb="tab"] { border-radius:10px 10px 0 0; }
div[data-testid="stChatMessage"] { background:white;border:1px solid var(--line);border-radius:14px; }
hr { border-color:var(--line); }
</style>
""", unsafe_allow_html=True)

# ---------- Demo data (synthetic; matches the original portfolio prototype) ----------
DEMO_FLOWS = [
    {"id":"welcome","name":"Welcome series","status":"live","trigger":"Subscribed to email list","emails":3},
    {"id":"cart","name":"Abandoned cart recovery","status":"live","trigger":"Started Checkout · no order","emails":3},
    {"id":"browse","name":"Browse abandonment","status":"draft","trigger":"Viewed product · no cart","emails":2},
    {"id":"post","name":"Post-purchase care","status":"live","trigger":"Placed order","emails":3},
    {"id":"winback","name":"Customer win-back","status":"draft","trigger":"No purchase in 120 days","emails":2},
    {"id":"review","name":"Review & UGC request","status":"live","trigger":"Order delivered","emails":1},
]
DEMO_PROFILES = [
    {"id":"p1","name":"Olivia Bennett","email":"olivia.bennett@example.test","segment":"Repeat customer","interest":"Pet portraits","ltv":428},
    {"id":"p2","name":"Noah Williams","email":"noah.williams@example.test","segment":"High-value","interest":"Family portraits","ltv":890},
    {"id":"p3","name":"Amelia Carter","email":"amelia.carter@example.test","segment":"Cart abandoner","interest":"Watercolour pet art","ltv":0},
    {"id":"p4","name":"Oliver Smith","email":"oliver.smith@example.test","segment":"First-time buyer","interest":"Custom couple portrait","ltv":149},
    {"id":"p5","name":"Isla Thompson","email":"isla.thompson@example.test","segment":"At-risk customer","interest":"Family canvas","ltv":312},
]
DEMO_CAMPAIGNS = [
    {"id":"m1","name":"Welcome series","status":"flow","sent":12000,"clicks":1320,"orders":154,"revenue":8420},
    {"id":"m2","name":"Abandoned cart recovery","status":"flow","sent":8600,"clicks":1190,"orders":172,"revenue":9760},
    {"id":"m3","name":"Post-purchase care","status":"flow","sent":9200,"clicks":1480,"orders":204,"revenue":6940},
    {"id":"m4","name":"November studio edit","status":"campaign","sent":24000,"clicks":1660,"orders":95,"revenue":16450},
]

def secret(name: str, default: str = "") -> str:
    try:
        return str(st.secrets.get(name, os.getenv(name, default))).strip()
    except Exception:
        return os.getenv(name, default).strip()

def fetch_klaviyo(path: str, method: str = "GET", payload: dict | None = None) -> dict:
    key = secret("KLAVIYO_PRIVATE_API_KEY")
    if not key:
        raise RuntimeError("No Klaviyo private API key configured.")
    headers = {
        "Authorization": f"Klaviyo-API-Key {key}",
        "accept": "application/vnd.api+json",
        "revision": secret("KLAVIYO_API_REVISION", "2026-10-15"),
        "content-type": "application/vnd.api+json",
    }
    response = requests.request(method, f"https://a.klaviyo.com/api{path}", headers=headers, json=payload, timeout=18)
    response.raise_for_status()
    return response.json()

@st.cache_data(ttl=60, show_spinner=False)
def get_klaviyo_snapshot() -> dict:
    flows = fetch_klaviyo("/flows/?page[size]=50").get("data", [])
    campaigns = fetch_klaviyo("/campaigns/?page[size]=50&sort=-updated_at").get("data", [])
    profiles = fetch_klaviyo("/profiles/?page[size]=25").get("data", [])
    return {
        "flows":[{"id":x.get("id"),"name":x.get("attributes",{}).get("name","Untitled flow"),"status":x.get("attributes",{}).get("status","unknown"),"trigger":x.get("attributes",{}).get("trigger_type","Not specified"),"emails":None} for x in flows if not x.get("attributes",{}).get("archived")],
        "campaigns":[{"id":x.get("id"),"name":x.get("attributes",{}).get("name","Untitled campaign"),"status":x.get("attributes",{}).get("status","unknown"),"sent":None,"clicks":None,"orders":None,"revenue":None} for x in campaigns if not x.get("attributes",{}).get("archived")],
        "profiles":[{"id":x.get("id"),"name":" ".join(filter(None,[x.get("attributes",{}).get("first_name"),x.get("attributes",{}).get("last_name")])) or "Unnamed profile","email":x.get("attributes",{}).get("email",""),"segment":x.get("attributes",{}).get("properties",{}).get("segment","—"),"interest":x.get("attributes",{}).get("properties",{}).get("interest","—"),"ltv":x.get("attributes",{}).get("predictive_analytics",{}).get("historic_clv")} for x in profiles],
    }

def get_supabase_snapshot() -> dict | None:
    url = secret("SUPABASE_URL") or secret("NEXT_PUBLIC_SUPABASE_URL")
    key = secret("SUPABASE_ANON_KEY") or secret("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        return None
    headers = {"apikey":key,"Authorization":f"Bearer {key}"}
    try:
        def rows(table: str, query: str) -> list[dict]:
            response = requests.get(f"{url}/rest/v1/{table}?{query}",headers=headers,timeout=12)
            response.raise_for_status()
            return response.json()
        p = rows("customer_profiles","select=id,email,first_name,last_name,segment,interests,lifetime_value&is_demo=eq.true&order=lifetime_value.desc&limit=20")
        m = rows("campaign_metrics","select=id,campaign_name,sent,clicks,orders,attributed_revenue&is_demo=eq.true&order=metric_date.desc&limit=20")
        f = rows("lifecycle_flows","select=flow_key,name,trigger_event,status,email_count&is_demo=eq.true&limit=20")
        if not (p and m and f):
            return None
        return {
            "profiles":[{"id":r["id"],"email":r.get("email",""),"name":" ".join(filter(None,[r.get("first_name"),r.get("last_name")])) or "Unnamed profile","segment":r.get("segment") or "—","interest":", ".join(r.get("interests") or []) or "—","ltv":float(r.get("lifetime_value") or 0)} for r in p],
            "campaigns":[{"id":r["id"],"name":r.get("campaign_name","Untitled campaign"),"status":"flow" if r.get("campaign_name") in {x["name"] for x in DEMO_FLOWS} else "campaign","sent":r.get("sent"),"clicks":r.get("clicks"),"orders":r.get("orders"),"revenue":float(r.get("attributed_revenue") or 0)} for r in m],
            "flows":[{"id":r.get("flow_key"),"name":r.get("name","Untitled flow"),"status":r.get("status","unknown"),"trigger":r.get("trigger_event","Not specified"),"emails":r.get("email_count")} for r in f],
        }
    except Exception:
        return None

def get_supabase_counts() -> dict | None:
    snapshot = get_supabase_snapshot()
    if not snapshot:
        return None
    return {"customer_profiles":len(snapshot["profiles"]),"campaign_metrics":len(snapshot["campaigns"]),"lifecycle_flows":len(snapshot["flows"])}

def money(v: float) -> str:
    return "£" + f"{v:,.0f}"

def panel(title: str, subtitle: str = ""):
    st.markdown(f'<div class="panel"><div class="panel-title">{title}</div><div class="panel-sub">{subtitle}</div>',unsafe_allow_html=True)

def panel_end():
    st.markdown("</div>",unsafe_allow_html=True)

def fmt_time(minutes: int) -> str:
    if minutes < 60: return f"{minutes}m"
    hours = minutes // 60
    if hours < 48: return f"{hours}h" if minutes % 60 == 0 else f"{hours}h {minutes%60}m"
    days, rem = divmod(hours,24)
    return f"{days}d" if rem == 0 else f"{days}d {rem}h"

# ---------- Journey simulator ----------
def simulate_cart(first_name: str, product: str, value: float, consent: bool, order_at: int | None, offer: str) -> dict:
    events, emails, path = [], [], []
    def add(t, node, kind, title, detail):
        events.append({"time":fmt_time(t),"minute":t,"node":node,"event":kind,"title":title,"detail":detail})
        path.append(node)
    add(0,"trigger","enter","Started Checkout","Checkout event starts the journey.")
    if not consent:
        add(0,"filter","skip","Entry filter: email consent","Profile is not subscribed. No marketing email is sent.")
        add(0,"exit","exit","Exit","Not eligible: email consent is missing.")
        return {"events":events,"emails":emails,"sent":0,"converted":False,"organic":False,"attributed":None,"reason":"No email consent"}
    add(0,"filter","check","Entry filter: email consent","Subscribed profile is eligible.")
    checkpoints = [(60,"email1","Reassurance"),(1500,"email2","Social proof"),(4380,"email3a" if value >= 150 else "email3b","Value-add offer" if value >= 150 else "Last reminder")]
    subjects = [
        f"{first_name or 'There'}, your {product} is waiting",
        f"A little more about your custom {product}",
        f"One last look at your {product}",
    ]
    bodies = [
        f"Your {product} is still in your cart. Every artwork is artist-reviewed, and you can see a free digital preview before it is finalised.",
        f"See how our artists turn your idea into a personal piece. Your {product} is ready whenever you are.",
        f"{offer if value >= 150 else 'Your saved artwork is still here.'} We would love to help you complete your order.",
    ]
    sent = 0
    for idx,(minute,node,label) in enumerate(checkpoints):
        add(minute,f"wait{idx+1}","wait",f"Wait {['1 hour','24 hours','48 hours'][idx]}", "The shopper has time to convert before the next message.")
        if order_at is not None and order_at <= minute:
            add(order_at,"order","order","Placed Order", "Purchase occurs before this email; Klaviyo exits the flow.")
            add(order_at,"exit","exit","Exit: converted", "No further recovery emails are sent.")
            return {"events":sorted(events,key=lambda x:x["minute"]),"emails":emails,"sent":sent,"converted":True,"organic":sent==0,"attributed":None if sent==0 else f"Email {sent}","reason":"Purchased"}
        email_num = idx+1
        if idx == 2: email_num = 3
        emails.append({"time":fmt_time(minute),"node":node,"subject":subjects[idx],"body":bodies[idx],"cta":"Complete your order"})
        sent += 1
        add(minute,node,"send",f"Email {email_num} · {label}",f"Sent to eligible profile. Subject: {subjects[idx]}")
    if order_at is not None and order_at <= 5760:
        add(order_at,"order","order","Placed Order","Purchase occurs after the final email.")
        add(order_at,"exit","exit","Exit: converted","Journey ends after purchase.")
        return {"events":sorted(events,key=lambda x:x["minute"]),"emails":emails,"sent":sent,"converted":True,"organic":False,"attributed":"Email 3","reason":"Purchased after email 3"}
    add(5760,"exit","exit","Exit: sequence complete","No order was recorded during the journey.")
    return {"events":events,"emails":emails,"sent":sent,"converted":False,"organic":False,"attributed":None,"reason":"Sequence complete"}

# ---------- Campaign copy + QA ----------
def make_copy(product: str, audience: str, offer: str, tone: str) -> dict:
    api_key = secret("GEMINI_API_KEY") or secret("GOOGLE_API_KEY")
    if api_key:
        try:
            brief = f"Create ethical D2C email copy for product={product}; audience={audience}; offer={offer}; tone={tone}. Return JSON only with keys subjects (array of exactly 3), preheader, headline, body, cta. No invented discounts, scarcity or unsupported claims. Keep copy concise."
            response = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",json={"contents":[{"parts":[{"text":brief}]}],"generationConfig":{"temperature":0.55,"maxOutputTokens":600,"responseMimeType":"application/json"}},timeout=25)
            response.raise_for_status()
            raw = response.json()["candidates"][0]["content"]["parts"][0]["text"]
            generated = json.loads(raw)
            if len(generated.get("subjects",[])) == 3 and generated.get("body") and generated.get("cta"):
                generated["mode"]="ai"
                return generated
        except Exception:
            pass
    greeting = {"Warm":"A thoughtful little reminder","Premium":"A considered piece, made just for you","Playful":"Your future favourite artwork is waiting","Direct":"Your saved artwork is ready"}[tone]
    return {
        "subjects":[f"Your {product} is waiting",f"A little more about your {product}",f"{offer} — just for you"],
        "preheader":f"Your idea, brought to life by our artists. {offer}",
        "headline":greeting,
        "body":f"Hello there,\n\nWe noticed you were exploring {product.lower()}. Every piece is created with care and reviewed by our artists. {offer}.\n\nWhenever you're ready, your saved selection is here. We would be delighted to make something meaningful for you.",
        "cta":"Continue your order",
        "mode":"demo",
    }

def run_qa(copy: dict) -> list[dict]:
    checks = []
    def check(label, ok, detail, warn=False):
        checks.append({"Check":label,"Status":"PASS" if ok else ("WARN" if warn else "BLOCK"),"Detail":detail})
    subjects = copy.get("subjects",[])
    check("Subject lines",len(subjects)>=3,"At least three subject line options are available.")
    check("Subject length",all(15<=len(s)<=60 for s in subjects),"Recommended range: 15–60 characters.",warn=True)
    check("Preheader",bool(copy.get("preheader")) and len(copy.get("preheader",""))<=100,"Preheader is present and within 100 characters.",warn=True)
    body = copy.get("body","")
    check("Body content",len(body.strip())>=80,"Email body has meaningful content.")
    check("CTA",bool(copy.get("cta")),"A clear call to action is present.")
    check("Personalisation fallback","{{" not in body or "default" in body.lower(),"Check missing profile attributes have safe fallback values.",warn=True)
    return checks

def assistant_answer(question: str, context: dict) -> tuple[str,str]:
    q = question.lower()
    api_key = secret("GEMINI_API_KEY") or secret("GOOGLE_API_KEY")
    if api_key:
        try:
            prompt = ("You are ArtFlow AI, a concise D2C lifecycle marketing copilot. Use only the workspace context below for factual claims. Clearly identify synthetic/demo data. Never claim to send campaigns or activate flows. No customer personal data. Answer in 2-5 sentences.\n\nContext: "+json.dumps(context)+"\n\nQuestion: "+question)
            r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}",json={"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.35,"maxOutputTokens":350}},timeout=20)
            r.raise_for_status()
            answer = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            return answer,"Gemini AI"
        except Exception:
            pass
    if any(x in q for x in ["cart","checkout","abandon"]):
        return "The abandoned-cart journey starts with Started Checkout, checks email consent, waits one hour, then sends reassurance and social-proof emails. A purchase exits the flow immediately. Carts worth £150 or more receive a value-add message rather than a blanket discount. This is a simulated portfolio journey.","Demo response"
    if "campaign" in q:
        return f"The workspace currently shows {context['campaigns']} campaign records and {context['flows']} lifecycle flows. The current dataset is synthetic unless a live Klaviyo connection is explicitly confirmed.","Demo response"
    if "segment" in q or "customer" in q:
        return f"The demo contains {context['profiles']} profile records across segments including repeat customers, high-value shoppers, cart abandoners, first-time buyers and at-risk customers. Customer identifiers are not included in this assistant's context.","Demo response"
    if any(x in q for x in ["revenue","performance","metric"]):
        return f"Current synthetic demo revenue is {money(context['revenue'])} across {context['orders']} orders. Treat these as illustrative portfolio figures, not actual store performance.","Demo response"
    if "qa" in q or "quality" in q or "email" in q:
        return "The AI QA workspace checks subject lines, preheader length, body content, CTA presence and personalisation fallback. The human approval gate remains closed until blocking checks pass and manual review items are completed.","Demo response"
    return "I'm ArtFlow AI. I can help explain campaign performance, customer segments, lifecycle flows, abandoned-cart logic and email QA. Ask me about a specific area and I'll walk you through it. This workspace uses synthetic demo data unless a live Klaviyo connection is shown.","Demo response"

# ---------- Sidebar ----------
with st.sidebar:
    st.markdown('<div class="brand"><div class="brandmark">✦</div><div><div class="brandname">artflow<span>ai</span></div><div class="brandtag">GROWTH INTELLIGENCE</div></div></div>',unsafe_allow_html=True)
    st.markdown('<div class="workspace"><b>ArtFlow</b><br><span class="small-muted">D2C DEMO WORKSPACE</span></div>',unsafe_allow_html=True)
    st.markdown('<div class="eyebrow">WORKSPACE</div>',unsafe_allow_html=True)
    pages = ["Overview","Abandoned cart","Campaign studio","Lifecycle flows","Customers","AI QA","Integrations","Talk to ArtFlow"]
    page = st.radio("Navigate",pages,label_visibility="collapsed")
    st.divider()
    klaviyo_key_present = bool(secret("KLAVIYO_PRIVATE_API_KEY"))
    st.markdown(f'<span class="pill {"pill-green" if klaviyo_key_present else ""}">{"KLAVIYO KEY ADDED" if klaviyo_key_present else "SYNTHETIC DEMO"}</span>',unsafe_allow_html=True)
    st.caption("Portfolio prototype · Read-only integration")
    st.caption("No campaigns are sent or flows activated.")

# ---------- Data loading ----------
flows, campaigns, profiles = DEMO_FLOWS.copy(), DEMO_CAMPAIGNS.copy(), DEMO_PROFILES.copy()
data_mode, connection_message, warnings = "demo", "Demo mode. Add a restricted Klaviyo private API key to connect a test account.", []
supabase_snapshot = get_supabase_snapshot()
if supabase_snapshot:
    flows, campaigns, profiles = supabase_snapshot["flows"], supabase_snapshot["campaigns"], supabase_snapshot["profiles"]
    data_mode, connection_message = "supabase-demo", "Supabase synthetic demo tables connected. Klaviyo remains read-only and optional."
if klaviyo_key_present:
    try:
        snap = get_klaviyo_snapshot()
        flows, campaigns, profiles = snap["flows"], snap["campaigns"], snap["profiles"]
        data_mode, connection_message = "live", "Klaviyo API authentication successful. Campaign performance metrics remain unavailable unless reporting scopes are configured."
    except Exception as exc:
        warnings.append(f"Klaviyo read failed; showing synthetic data. ({str(exc)[:160]})")
        connection_message = "Klaviyo key configured, but connection could not be verified."

supabase_counts = {"customer_profiles":len(supabase_snapshot["profiles"]),"campaign_metrics":len(supabase_snapshot["campaigns"]),"lifecycle_flows":len(supabase_snapshot["flows"])} if supabase_snapshot else None
demo_revenue = sum(x["revenue"] for x in DEMO_CAMPAIGNS)
demo_orders = sum(x["orders"] for x in DEMO_CAMPAIGNS)
flow_revenue = sum(x["revenue"] for x in DEMO_CAMPAIGNS if x["status"]=="flow")
campaign_revenue = demo_revenue-flow_revenue
context = {"campaigns":len(campaigns),"flows":len(flows),"profiles":len(profiles),"revenue":demo_revenue,"orders":demo_orders}

# ---------- Header ----------
st.markdown(f'<div class="eyebrow">ARTFLOW AI　/　{page.upper()}</div>',unsafe_allow_html=True)
st.title("Growth workspace" if page=="Overview" else page)
intro = {
"Overview":"Your customer lifecycle marketing at a glance.",
"Abandoned cart":"Interactive demo: watch an abandoned-cart flow decide, wait, send and exit for different shoppers.",
"Campaign studio":"Generate subject lines and email copy, with automatic checks on every result.",
"Lifecycle flows":"Lifecycle automations mapped to Klaviyo flow concepts.",
"Customers":"Understand lifecycle stages, interests and customer value.",
"AI QA":"Deterministic checks plus a human approval gate before anything reaches Klaviyo.",
"Integrations":"Server-side connections and what each one is allowed to do.",
"Talk to ArtFlow":"Ask questions about the workspace, lifecycle strategy and campaign QA.",
}
st.markdown(f'<div class="page-intro">{intro[page]}</div>',unsafe_allow_html=True)
if warnings:
    for w in warnings: st.warning(w)
if data_mode=="demo":
    st.info("Synthetic demo workspace · All sample customer records and revenue values are illustrative.")

# ---------- Overview ----------
if page=="Overview":
    c1,c2,c3,c4 = st.columns(4)
    for col,label,value,note in [
        (c1,"30-DAY ATTRIBUTED REVENUE",money(demo_revenue),"Synthetic demo data"),
        (c2,"ATTRIBUTED ORDERS",f"{demo_orders:,}","Illustrative orders"),
        (c3,"LIFECYCLE FLOWS",str(len(flows)),"Klaviyo-style automations"),
        (c4,"CUSTOMER PROFILES",str(len(profiles)),"Demo profiles"),
    ]:
        with col: st.markdown(f'<div class="kpi"><div class="kpi-label">{label}</div><div class="kpi-value">{value}</div><div class="kpi-note">{note}</div></div>',unsafe_allow_html=True)
    st.write("")
    left,right=st.columns([1.4,1])
    with left:
        panel("Revenue contribution","Illustrative 30-day revenue split by lifecycle flows and campaigns")
        rev=pd.DataFrame({"Channel":["Lifecycle flows","Campaigns"],"Revenue":[flow_revenue,campaign_revenue]})
        fig=px.bar(rev,x="Channel",y="Revenue",text=rev["Revenue"].map(lambda x:money(x)),color="Channel",color_discrete_sequence=["#8068ef","#b9a9fa"])
        fig.update_layout(showlegend=False,plot_bgcolor="white",paper_bgcolor="white",margin=dict(l=5,r=5,t=8,b=5),yaxis_title="",xaxis_title="",font_color="#596176")
        st.plotly_chart(fig,use_container_width=True)
        panel_end()
    with right:
        panel("Workspace health","Connection and data-source summary")
        st.markdown(f'<p><span class="pill {"pill-green" if data_mode=="live" else ""}">{data_mode.upper()} DATA</span></p>',unsafe_allow_html=True)
        st.write(connection_message)
        st.markdown("---")
        st.markdown("**Integrations**")
        st.write("• Klaviyo: "+("API key configured" if klaviyo_key_present else "Not connected"))
        st.write("• Supabase: "+("Connected" if supabase_counts else "Optional / not configured"))
        st.write("• AI assistant: "+("Gemini key configured" if (secret("GEMINI_API_KEY") or secret("GOOGLE_API_KEY")) else "Rule-based demo fallback"))
        panel_end()
    st.subheader("Campaign performance snapshot")
    st.dataframe(pd.DataFrame(DEMO_CAMPAIGNS).assign(CTR=lambda d:(d.clicks/d.sent*100).round(2).astype(str)+"%").rename(columns={"name":"Campaign","status":"Type","sent":"Sent","clicks":"Clicks","orders":"Orders","revenue":"Revenue","CTR":"CTR"}),hide_index=True,use_container_width=True)
    st.caption("Revenue and campaign figures above are synthetic. Live Klaviyo connection currently reads account objects, flows, campaigns and profiles; this demo does not infer live revenue.")

# ---------- Abandoned cart ----------
elif page=="Abandoned cart":
    st.markdown('<span class="pill">INTERACTIVE JOURNEY SIMULATOR</span>',unsafe_allow_html=True)
    st.write("")
    with st.expander("Run a ready-made scenario",expanded=True):
        scenario=st.radio("Scenario",["Recovered by email 2","Never returns","Buys on their own","No email consent"],horizontal=True)
    defaults={
        "Recovered by email 2":("Amelia","Custom pet portrait",185,True,1800),
        "Never returns":("Noah","Family portrait",320,True,None),
        "Buys on their own":("Olivia","Pet portrait",120,True,20),
        "No email consent":("Oliver","Couple portrait",149,False,None),
    }
    d=defaults[scenario]
    a,b,c=st.columns(3)
    with a: first=st.text_input("First name",d[0],key="cart_first_name"); product=st.text_input("Product",d[1],key="cart_product")
    with b: value=st.number_input("Cart value (£)",min_value=0.0,value=float(d[2]),step=5.0); consent=st.toggle("Email marketing consent",value=d[3])
    with c: offer=st.text_input("Value-add offer","Free digital preview with every order"); order_choice=st.selectbox("Purchase timing",["Never", "20 minutes", "1 hour", "12 hours","25 hours","26 hours","49 hours","72 hours"],index={None:0,20:1,60:2,720:3,1500:4,1560:5,2940:6}.get(d[4],0))
    order_map={"Never":None,"20 minutes":20,"1 hour":60,"12 hours":720,"25 hours":1500,"26 hours":1560,"49 hours":2940,"72 hours":4320}
    if scenario=="Recovered by email 2": order_choice="26 hours"
    elif scenario=="Buys on their own": order_choice="20 minutes"
    elif scenario=="No email consent": order_choice="Never"
    order_at=order_map[order_choice]
    if st.button("▶ Run journey",type="primary",use_container_width=False):
        st.session_state["journey_result"]=simulate_cart(first,product,value,consent,order_at,offer)
    if "journey_result" not in st.session_state:
        st.session_state["journey_result"]=simulate_cart(*d[:4],d[4],offer)
    result=st.session_state["journey_result"]
    x1,x2,x3=st.columns(3)
    x1.metric("Emails sent",result["sent"])
    x2.metric("Converted","Yes" if result["converted"] else "No")
    x3.metric("Attribution",result["attributed"] or ("Organic" if result["organic"] else "—"))
    st.markdown("**Journey timeline**")
    st.dataframe(pd.DataFrame(result["events"])[["time","event","title","detail"]].rename(columns={"time":"Time","event":"Event","title":"Journey step","detail":"What happened"}),hide_index=True,use_container_width=True)
    if result["emails"]:
        st.subheader("Email previews")
        for i,email in enumerate(result["emails"],1):
            with st.expander(f"Email {i} · {email['subject']}"):
                st.caption("SUBJECT"); st.write(email["subject"])
                st.caption("BODY"); st.write(email["body"])
                st.button(email["cta"],key=f"cart_cta_{i}",disabled=True)
    st.caption("Journey rules: Started Checkout trigger · email-consent filter · 1h / 24h / 48h waits · Placed Order exit · £150 value split. Simulation only; no messages are sent.")

# ---------- Campaign studio ----------
elif page=="Campaign studio":
    col1,col2=st.columns([1,1.2])
    with col1:
        panel("Campaign brief","Set the context for your email")
        product=st.text_input("Product","Custom pet portrait")
        audience=st.selectbox("Audience",["Cart abandoners","First-time buyers","Repeat customers","High-value customers","At-risk customers"])
        offer=st.text_input("Offer / value proposition","Free digital preview with every order")
        tone=st.selectbox("Tone",["Warm","Premium","Playful","Direct"])
        if st.button("✨ Generate campaign copy",type="primary",use_container_width=True):
            st.session_state["campaign_copy"]=make_copy(product,audience,offer,tone)
            st.session_state["campaign_copy"]["checks"]=run_qa(st.session_state["campaign_copy"])
            st.session_state["manual_qa"]={}
        panel_end()
    with col2:
        panel("Generated content","Demo copy generator · connect an AI provider in Streamlit secrets for Gemini-powered responses")
        copy=st.session_state.get("campaign_copy")
        if copy:
            st.markdown("**Subject line options**")
            for i,s in enumerate(copy["subjects"],1): st.write(f"{i}. {s}")
            st.markdown("**Preheader**"); st.info(copy["preheader"])
            st.markdown("**Headline**"); st.subheader(copy["headline"])
            st.markdown("**Email body**"); st.write(copy["body"])
            st.markdown("**CTA**"); st.button(copy["cta"],disabled=True,key="preview_cta")
        else:
            st.caption("Complete the campaign brief and generate copy to see the preview.")
        panel_end()
    if st.session_state.get("campaign_copy"):
        if st.button("Continue to AI QA →",type="primary"):
            st.session_state["page_from_studio"]=True
            st.session_state["qa_checks"]=st.session_state["campaign_copy"]["checks"]
            st.info("Open AI QA from the left navigation to complete the approval checklist.")

# ---------- Lifecycle flows ----------
elif page=="Lifecycle flows":
    df=pd.DataFrame(flows)
    if not df.empty:
        st.dataframe(df.rename(columns={"name":"Flow","status":"Status","trigger":"Trigger","emails":"Emails","id":"ID"}),hide_index=True,use_container_width=True)
    st.subheader("Lifecycle flow map")
    flow_details=[
        ("Welcome series","Subscribed to email list","3","Introduce the brand, set expectations and guide the first purchase."),
        ("Abandoned cart recovery","Started Checkout · no order","3","Recover intent with reassurance, social proof and a value-add split."),
        ("Browse abandonment","Viewed product · no cart","2","Bring shoppers back to products they explored."),
        ("Post-purchase care","Placed order","3","Confirm the experience, share care guidance and cross-sell thoughtfully."),
        ("Customer win-back","No purchase in 120 days","2","Re-engage dormant customers with relevant product discovery."),
        ("Review & UGC request","Order delivered","1","Collect feedback and permissioned customer content."),
    ]
    for name,trigger,count,desc in flow_details:
        with st.expander(f"{name}  ·  {count} emails"):
            st.markdown(f"**Trigger:** {trigger}")
            st.write(desc)
            if name=="Abandoned cart recovery" and st.button("Open journey simulator",key="open_cart_flow"):
                st.session_state["page_jump"]="Abandoned cart"
                st.info("Select Abandoned cart in the navigation to run the simulator.")
    st.caption("Flow objects are read-only. This portfolio app never activates or edits live Klaviyo flows.")

# ---------- Customers ----------
elif page=="Customers":
    st.markdown("Synthetic profiles for demonstrating segmentation and journey personalisation.")
    if profiles:
        df=pd.DataFrame(profiles)
        if "ltv" in df:
            df["ltv"]=df["ltv"].apply(lambda x: money(float(x)) if x is not None else "—")
        st.dataframe(df.rename(columns={"name":"Customer","email":"Email","segment":"Segment","interest":"Interest","ltv":"Lifetime value","id":"Profile ID"}),hide_index=True,use_container_width=True)
        segments=pd.DataFrame(profiles).groupby("segment",dropna=False).size().reset_index(name="Profiles")
        fig=px.bar(segments,x="segment",y="Profiles",text="Profiles",color="segment",color_discrete_sequence=px.colors.sequential.Purples)
        fig.update_layout(showlegend=False,plot_bgcolor="white",paper_bgcolor="white",margin=dict(l=5,r=5,t=8,b=5),xaxis_title="",yaxis_title="")
        st.plotly_chart(fig,use_container_width=True)
        selected=st.selectbox("Choose a profile to explore",profiles,format_func=lambda p:f"{p['name']} · {p['segment']}")
        if selected:
            x,y,z=st.columns(3)
            x.metric("Segment",selected.get("segment","—"))
            y.metric("Interest",selected.get("interest","—"))
            z.metric("Lifetime value",money(float(selected["ltv"])) if selected.get("ltv") is not None else "Not available")
            if st.button("Use this profile in abandoned-cart simulator"):
                st.session_state["cart_prefill"]=selected
                st.session_state["cart_first_name"]=selected.get("name","").split(" ")[0]
                st.session_state["cart_product"]=selected.get("interest","Custom portrait")
                st.info("Profile selected. Open Abandoned cart from the navigation.")
    st.caption("Only synthetic sample profiles are included by default. Live Klaviyo profiles may contain personal data; this prototype does not write to profiles.")

# ---------- AI QA ----------
elif page=="AI QA":
    copy=st.session_state.get("campaign_copy")
    if not copy:
        st.warning("Generate campaign content in Campaign studio before running QA.")
        st.stop()
    checks=run_qa(copy)
    st.subheader("Automated pre-send checks")
    st.dataframe(pd.DataFrame(checks),hide_index=True,use_container_width=True)
    st.subheader("Human review gate")
    manual_items=["Offer and claims verified","Audience and suppression rules checked","Links and tracking parameters tested","Rendering reviewed on mobile and desktop","Legal, consent and unsubscribe details checked"]
    if "manual_qa" not in st.session_state: st.session_state["manual_qa"]={}
    for item in manual_items:
        st.session_state["manual_qa"][item]=st.checkbox(item,value=st.session_state["manual_qa"].get(item,False),key="qa_"+item)
    blocking=any(x["Status"]=="BLOCK" for x in checks)
    manual_done=all(st.session_state["manual_qa"].get(x,False) for x in manual_items)
    if blocking:
        st.error("Approval locked: fix blocking checks before approval.")
    elif not manual_done:
        st.warning("Approval locked: complete every manual review item.")
    else:
        st.success("QA gate passed. Human approval is complete for this demo asset.")
    st.caption("Approval is a local demo state only. It does not publish, schedule or send a campaign.")

# ---------- Integrations ----------
elif page=="Integrations":
    st.subheader("Connection status")
    a,b,c=st.columns(3)
    a.metric("Klaviyo","Configured" if klaviyo_key_present else "Not connected")
    b.metric("Supabase","Connected" if supabase_counts else "Optional")
    c.metric("AI assistant","Gemini" if (secret("GEMINI_API_KEY") or secret("GOOGLE_API_KEY")) else "Demo fallback")
    panel("Klaviyo","Read-only API integration")
    st.write(connection_message)
    st.write("Read scopes used: accounts, flows, campaigns and profiles. Reporting metrics are not represented as live unless successfully retrieved.")
    st.caption("Add KLAVIYO_PRIVATE_API_KEY and KLAVIYO_API_REVISION in Streamlit app secrets. Never commit a private API key.")
    panel_end()
    panel("Supabase","Optional persistence layer")
    st.write("The app can check the existing demo tables using the Supabase REST API. Synthetic demo data remains available when Supabase is not configured.")
    st.write(f"Connection: {'Available' if supabase_counts else 'Not configured / unreachable'}")
    if supabase_counts: st.json(supabase_counts)
    st.caption("Use SUPABASE_URL and SUPABASE_ANON_KEY (or the existing NEXT_PUBLIC variables) in Streamlit secrets.")
    panel_end()
    panel("AI provider","Optional Gemini API")
    st.write("Set GEMINI_API_KEY to enable Gemini-powered assistant answers. Without it, ArtFlow uses local deterministic responses.")
    panel_end()
    st.warning("Security: use a restricted Klaviyo private key with read-only scopes. No campaign sends, flow activation, profile updates or event writes are implemented in this Streamlit edition.")

# ---------- Talk to ArtFlow ----------
elif page=="Talk to ArtFlow":
    st.markdown('<span class="pill">ARTFLOW AI ASSISTANT</span>',unsafe_allow_html=True)
    st.write("Ask about campaign performance, customer segments, lifecycle flows, abandoned carts or email QA.")
    if "chat_history" not in st.session_state:
        st.session_state["chat_history"]=[{"role":"assistant","content":"Hi! I'm your ArtFlow AI assistant. Ask me about campaign performance, customer segments, lifecycle flows, abandoned carts or email QA."}]
    for msg in st.session_state["chat_history"]:
        with st.chat_message(msg["role"]):
            st.write(msg["content"])
    prompt=st.chat_input("Ask ArtFlow anything…")
    audio=st.audio_input("Or record a question (transcription requires an OpenAI API key)")
    if audio is not None and st.button("Transcribe and ask"):
        openai_key=secret("OPENAI_API_KEY")
        if not openai_key:
            st.warning("Add OPENAI_API_KEY in Streamlit secrets to transcribe recorded audio. You can also type your question below.")
        else:
            try:
                files={"file":("question.wav",audio.getvalue(),"audio/wav")}
                r=requests.post("https://api.openai.com/v1/audio/transcriptions",headers={"Authorization":f"Bearer {openai_key}"},files=files,data={"model":"whisper-1"},timeout=45)
                r.raise_for_status()
                prompt=r.json().get("text","").strip()
            except Exception as exc:
                st.error(f"Audio transcription failed: {str(exc)[:180]}")
    if prompt:
        st.session_state["chat_history"].append({"role":"user","content":prompt})
        with st.chat_message("user"): st.write(prompt)
        answer,mode=assistant_answer(prompt,context)
        st.session_state["chat_history"].append({"role":"assistant","content":answer})
        with st.chat_message("assistant"):
            st.write(answer)
            st.caption(mode)
    st.caption("Assistant receives aggregate workspace context only. It does not receive profile names or email addresses, and cannot send campaigns or modify records.")

st.divider()
st.markdown('<div class="small-muted">ARTFLOW AI · KLAVIYO GROWTH INTELLIGENCE　　Portfolio prototype · Synthetic demo data unless a live source is explicitly confirmed.</div>',unsafe_allow_html=True)
