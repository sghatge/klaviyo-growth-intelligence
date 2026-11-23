create extension if not exists pgcrypto;
create table if not exists public.customer_profiles (
 id uuid primary key default gen_random_uuid(), external_id text unique, email text not null unique,
 first_name text, last_name text, lifecycle_stage text not null default 'subscriber', segment text,
 interests text[] not null default '{}', lifetime_value numeric(12,2) not null default 0,
 last_activity_at timestamptz, is_demo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.campaign_briefs (
 id uuid primary key default gen_random_uuid(), name text not null, audience text not null, objective text not null,
 offer text, generated_subject text, generated_body text, status text not null default 'draft',
 is_demo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.lifecycle_flows (
 id uuid primary key default gen_random_uuid(), flow_key text unique not null, name text not null,
 trigger_event text not null, description text, status text not null default 'draft',
 email_count integer not null default 1, is_demo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.qa_runs (
 id uuid primary key default gen_random_uuid(), campaign_id uuid references public.campaign_briefs(id) on delete set null,
 checks jsonb not null default '[]'::jsonb, passed_count integer not null default 0,
 warning_count integer not null default 0, failed_count integer not null default 0,
 approved_by_human boolean not null default false, is_demo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.campaign_metrics (
 id uuid primary key default gen_random_uuid(), campaign_name text not null, channel text not null default 'email',
 sent integer not null default 0, delivered integer not null default 0, clicks integer not null default 0,
 orders integer not null default 0, attributed_revenue numeric(12,2) not null default 0,
 metric_date date not null default current_date, is_demo boolean not null default true, created_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
alter table public.campaign_briefs enable row level security;
alter table public.lifecycle_flows enable row level security;
alter table public.qa_runs enable row level security;
alter table public.campaign_metrics enable row level security;
create policy "read synthetic customer demo rows" on public.customer_profiles for select to anon, authenticated using (is_demo = true);
create policy "read synthetic campaign demo rows" on public.campaign_briefs for select to anon, authenticated using (is_demo = true);
create policy "read synthetic flow demo rows" on public.lifecycle_flows for select to anon, authenticated using (is_demo = true);
create policy "read synthetic QA demo rows" on public.qa_runs for select to anon, authenticated using (is_demo = true);
create policy "read synthetic metric demo rows" on public.campaign_metrics for select to anon, authenticated using (is_demo = true);
grant select on public.customer_profiles, public.campaign_briefs, public.lifecycle_flows, public.qa_runs, public.campaign_metrics to anon, authenticated;
insert into public.lifecycle_flows (flow_key,name,trigger_event,description,status,email_count) values
('welcome','Welcome series','Subscribed to email list','Introduce the studio, showcase bestsellers and guide new subscribers to their first portrait.','live',3),
('cart','Abandoned cart recovery','Added to cart · no order','Bring shoppers back with a product reminder, reassurance and a final nudge.','live',3),
('browse','Browse abandonment','Viewed product · no cart','Reconnect with visitors who explored a portrait style but did not add it to cart.','draft',2),
('post','Post-purchase care','Placed order','Set expectations, request a review and recommend complementary artwork.','live',3),
('winback','Customer win-back','No purchase in 120 days','Re-engage past customers with new styles and a relevant reason to return.','draft',2),
('review','Review & UGC request','Order delivered','Collect customer reviews and permissioned customer artwork photos.','live',1)
on conflict (flow_key) do nothing;
insert into public.customer_profiles (email,first_name,last_name,lifecycle_stage,segment,interests,lifetime_value,last_activity_at,is_demo) values
('olivia.bennett@example.test','Olivia','Bennett','repeat_customer','Repeat customer',array['Pet portraits'],428,now()-interval '2 days',true),
('noah.williams@example.test','Noah','Williams','vip','High-value',array['Family portraits'],890,now()-interval '5 days',true),
('amelia.carter@example.test','Amelia','Carter','cart_abandoner','Cart abandoner',array['Watercolour pet art'],0,now()-interval '1 hour',true),
('oliver.smith@example.test','Oliver','Smith','first_purchase','First-time buyer',array['Custom couple portrait'],149,now()-interval '1 day',true),
('isla.thompson@example.test','Isla','Thompson','at_risk','At-risk customer',array['Family canvas'],312,now()-interval '134 days',true)
on conflict (email) do nothing;
insert into public.campaign_metrics (campaign_name,channel,sent,delivered,clicks,orders,attributed_revenue,metric_date,is_demo) values
('Welcome series','email',12000,11880,1320,154,8420,current_date-2,true),
('Abandoned cart recovery','email',8600,8500,1190,172,9760,current_date-4,true),
('Post-purchase care','email',9200,9110,1480,204,6940,current_date-6,true),
('November studio edit','email',24000,23700,1660,95,16450,current_date-8,true);