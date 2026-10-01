-- Eucardia's own system of record.
--
-- The important thing about this schema: members exist here *before* Lithos ever
-- sees them. Eucardia sells a cardiometabolic membership — quarterly at-home
-- biomarker panels, a health coach, habit tracking — and only some members ever
-- escalate to medical care. When one does, we create a Lithos patient and store
-- the link; everything else stays ours.
--
-- Two id spaces meet here:
--   members.id              — Eucardia's identifier. This is what we send to
--                             Lithos as `external_id`, which Lithos stores
--                             immutably so the two systems can be reconciled.
--   members.lithos_patient_id — Lithos's `pat_…`, null until escalation.
--
-- The care_plans/encounters/orders tables are *projections*: local mirrors of
-- clinical state, written by the webhook worker (event arrives → GET the
-- resource → upsert here). Lithos remains the source of truth for them; this is
-- a read model so Eucardia can render a dashboard without N API calls, and keep
-- serving if Lithos is unreachable.

BEGIN;

-- ---------------------------------------------------------------- membership

CREATE TABLE IF NOT EXISTS members (
  id                 text PRIMARY KEY,            -- eu_mem_… — sent to Lithos as external_id
  email              text NOT NULL UNIQUE,
  first_name         text NOT NULL,
  last_name          text NOT NULL,
  date_of_birth      date NOT NULL,
  sex                text NOT NULL CHECK (sex IN ('female', 'male')),
  phone              text,
  address_line1      text,
  address_line2      text,
  city               text,
  state              text,
  postal_code        text,

  plan               text NOT NULL CHECK (plan IN ('essential', 'complete')),
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'paused', 'canceled')),
  joined_at          timestamptz NOT NULL DEFAULT now(),
  coach_name         text,
  stripe_customer_id text,

  -- Null until the member escalates to medical care. Unique so a member can
  -- never be linked to two Lithos patients, and vice versa.
  lithos_patient_id  text UNIQUE,
  lithos_linked_at   timestamptz,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Platform hard stop (Medicare / Medicaid / Tricare are excluded for every
-- partner). A membership business has no other reason to hold this, which is
-- exactly why it's a column: escalation has to answer it, and null means "ask".
ALTER TABLE members ADD COLUMN IF NOT EXISTS enrolled_in_government_insurance boolean;

-- Not everyone here bought a membership: someone who comes straight to the care
-- review is in Eucardia's records too — one person, one row, whichever door
-- they came in by — with no plan. (CHECK passes on NULL, so this is enough.)
ALTER TABLE members ALTER COLUMN plan DROP NOT NULL;

-- Every biomarker panel we hold, whoever drew it. `source` matters: Eucardia
-- ordered most of these long before Lithos existed for this member, and a
-- clinician reviewing an encounter sees only what the intake carries.
CREATE TABLE IF NOT EXISTS lab_panels (
  id                 text PRIMARY KEY,
  member_id          text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  drawn_on           date NOT NULL,
  source             text NOT NULL DEFAULT 'eucardia'
                       CHECK (source IN ('eucardia', 'lithos', 'external')),
  -- mg/dL unless noted
  ldl_c              numeric(6,1),
  apo_b              numeric(6,1),
  lp_a               numeric(6,1),               -- nmol/L
  hdl_c              numeric(6,1),
  triglycerides      numeric(6,1),
  total_cholesterol  numeric(6,1),
  hs_crp             numeric(6,2),               -- mg/L
  a1c                numeric(4,1),               -- %
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_panels_member_drawn_idx ON lab_panels (member_id, drawn_on DESC);

-- What the member is taking, and what they react to. A coaching business has
-- every reason to hold this, and the protocol requires current medications to
-- be listed — a clinician reading a nine-month-old LDL-C needs to know the
-- patient was on a statin when it was drawn.
CREATE TABLE IF NOT EXISTS member_medications (
  id               text PRIMARY KEY,
  member_id        text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name             text NOT NULL,           -- e.g. "atorvastatin 40 mg"
  kind             text NOT NULL DEFAULT 'other'
                     CHECK (kind IN ('lipid_lowering', 'other', 'allergy')),
  started_on       date,
  stopped_on       date,                    -- null = currently taking
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_medications_member_idx ON member_medications (member_id);

-- Treat-to-target: the number this member is being managed toward, and why.
CREATE TABLE IF NOT EXISTS member_targets (
  id            text PRIMARY KEY,
  member_id     text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ldl_c_target  numeric(6,1),
  apo_b_target  numeric(6,1),
  rationale     text,
  set_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS member_targets_member_idx ON member_targets (member_id, set_at DESC);

-- The coaching record. Deliberately separate from anything clinical: a coach is
-- not a clinician, and none of this is visible to a Lithos reviewer today.
CREATE TABLE IF NOT EXISTS coach_notes (
  id           text PRIMARY KEY,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  author       text NOT NULL,
  focus        text NOT NULL CHECK (focus IN ('diet', 'activity', 'sleep', 'adherence', 'review')),
  occurred_at  timestamptz NOT NULL,
  summary      text NOT NULL
);
CREATE INDEX IF NOT EXISTS coach_notes_member_idx ON coach_notes (member_id, occurred_at DESC);

-- Self-reported / device measurements from the app.
CREATE TABLE IF NOT EXISTS vitals (
  id           text PRIMARY KEY,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  recorded_at  timestamptz NOT NULL,
  weight_kg    numeric(5,1),
  systolic     integer,
  diastolic    integer,
  resting_hr   integer
);
CREATE INDEX IF NOT EXISTS vitals_member_idx ON vitals (member_id, recorded_at DESC);

-- ------------------------------------------------- projections of Lithos state

CREATE TABLE IF NOT EXISTS care_plans (
  lithos_care_plan_id text PRIMARY KEY,
  member_id           text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category            text NOT NULL,
  status              text NOT NULL,
  clinician_notes     text,
  activated_at        timestamptz,
  ineligible_at       timestamptz,
  raw                 jsonb NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS care_plans_member_idx ON care_plans (member_id);

CREATE TABLE IF NOT EXISTS encounters (
  lithos_encounter_id text PRIMARY KEY,
  member_id           text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lithos_care_plan_id text,
  status              text NOT NULL,
  encounter_type      text,
  escalation_reason   text,
  lithos_created_at   timestamptz,
  lithos_updated_at   timestamptz,
  completed_at        timestamptz,
  raw                 jsonb NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounters_member_idx ON encounters (member_id, lithos_created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  lithos_order_id     text PRIMARY KEY,
  member_id           text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lithos_encounter_id text,
  status              text NOT NULL,
  raw                 jsonb NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_member_idx ON orders (member_id);

-- A clinician's question to the member, relayed both ways by Eucardia. Opened
-- by Lithos when a reviewer escalates for information; the member's reply goes
-- back through us. ~10% of real encounters need one, and it's the partner work
-- the live partner struggles with — so it gets a first-class table.
CREATE TABLE IF NOT EXISTS inquiries (
  lithos_inquiry_id   text PRIMARY KEY,
  member_id           text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lithos_encounter_id text,
  subject             text,
  status              text NOT NULL,
  awaiting            text,
  closed_reason       text,
  closed_note         text,
  last_message_at     timestamptz,
  raw                 jsonb NOT NULL,
  synced_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_member_idx ON inquiries (member_id, last_message_at DESC);

-- A signed lab order. The member-facing action is handing over the PDF; the
-- result never comes back through the API, only as an uploaded document.
CREATE TABLE IF NOT EXISTS lab_requisitions (
  lithos_lab_requisition_id text PRIMARY KEY,
  member_id                 text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  lithos_encounter_id       text,
  preset                    text,
  status                    text NOT NULL,
  pdf_status                text,
  download_url              text,
  download_expires_at       timestamptz,
  valid_through             date,
  raw                       jsonb NOT NULL,
  synced_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_requisitions_member_idx ON lab_requisitions (member_id);

-- Every verified delivery, durably. This is the reconciliation instrument:
-- `processed_at` null with a `process_error` set is a delivery we verified but
-- failed to project, which is exactly the state a partner has to detect and
-- replay. `id` is Lithos's evt_… so re-delivery is idempotent.
CREATE TABLE IF NOT EXISTS webhook_events (
  id                text PRIMARY KEY,
  type              text NOT NULL,
  resource_id       text,
  lithos_created_at timestamptz,
  received_at       timestamptz NOT NULL DEFAULT now(),
  payload           jsonb NOT NULL,
  processed_at      timestamptz,
  process_error     text
);
CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx ON webhook_events (received_at)
  WHERE processed_at IS NULL;

COMMIT;
