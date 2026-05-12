# Merchant of Record Platform Research
*Researched May 2026 — for Rum-Runner Rhapsody (RRR) v1 monetization*

**Use case:** Solo Windows desktop app (Electron), one-time license ~$10–$25, possible future supporter tier. Needs license key delivery, global tax handling, minimal operational overhead.

---

## Quick Reference Table

| Platform | Full MoR | Fee (approx.) | License Keys | Founded | Trustpilot | G2 | Verdict |
|---|---|---|---|---|---|---|---|
| **Polar.sh** | ✅ | 4% + $0.40 | ✅ API-based | 2022 | ~9 reviews (no score) | — | **Top pick** |
| **Creem.io** | ✅ | 3.9% + $0.40 (+$7 payout fee) | ✅ API-based | 2021 | ~14 reviews (no score) | — | **Strong backup** |
| **Paddle** | ✅ | 5% + $0.50 | ⚠️ Upload list only | 2012 | 4.1/5 (10,143) | 4.4/5 (1,165) | Wait for scale |
| **Freemius** | ✅ | ~7–8% all-in | ✅ Best in class | 2014 | 2.5/5 (19) | 4.7/5 (61) | Best licensing; high fee |
| **Gumroad** | ✅ | 10% flat | ⚠️ Basic (no activation limits) | 2011 | 1.3/5 (382) | 4.2/5 (16) | Skip (fee) |
| **Payhip** | ⚠️ Partial (no US) | ~7.9–8% | ⚠️ Basic upload | 2011 | 4.5/5 (425) | — | Skip (US tax gap) |
| **Whop** | ⚠️ Partial (not global) | ~2.7% + $0.30 | ✅ Built-in | 2021 | 3.7/5 (2,560) | — | Skip (EU VAT exposure) |
| **FastSpring** | ✅ | ~7–9% all-in | ✅ Yes | 2005 | 3.6/5 (534) | 4.5/5 (204) | Skip (enterprise only) |
| **Dodo Payments** | ✅ | 4% + $0.40 (+1.5% intl +$30 chargeback) | ✅ API-based | 2023 | Mixed (~113) | — | Skip unless India/EM buyer base |
| **Fungies.io** | ✅ | 5% + $0.50 | ⚠️ Game keys only (CSV) | 2022 | 2.6/5 (32) | — | Skip (fund-hold reports) |
| **Lemon Squeezy** | ✅ (transitioning) | 5% + $0.50 | ✅ Best in class | 2020 | 1.2/5 (135) | — | **Do not use** |
| **Stripe (direct)** | ❌ | 2.9% + $0.30 | ❌ None native | 2010 | — | — | Skip (DIY tax burden) |

---

## Recommendation

**Use Polar.sh.** Full MoR (EU VAT, GST, US sales tax all handled), 4% + $0.40 fee, API-based license keys designed for desktop apps, open source, no approval friction, backed by $10M from Accel with serious founders (Birk Jernström, ex-Shopify via Tictail acquisition). The license key validation endpoint is authentication-free and works cleanly from an Electron app.

**If Polar gives trouble: Creem.io.** Slightly cheaper fee, same MoR coverage, good license key API. Newer company (€1.8M pre-seed, Estonian startup) — great early reviews but small sample.

**Do not use Lemon Squeezy.** Phil's email rejection experience is a documented, widespread pattern. Combined with Stripe acquisition uncertainty and reported payout freezes, it is not viable for a new account in 2026.

---

## Platform Profiles

---

### Polar.sh ⭐ *Top Pick*

**Company**
- Founded: 2022
- HQ: San Francisco, CA, USA
- Founder: Birk Jernström (previously founded Tictail, acquired by Shopify 2018; ex-Shopify Director of Product)
- Funding: $10M Seed, June 2025 — led by Accel. Angels include Guillermo Rauch (Vercel), Tobi Lütke & Harley Finkelstein (Shopify), Paul Copplestone (Supabase), Thomas Paul Mann (Raycast), Zeno Rocha (Resend).
- Scale: 17,000+ signups; 120%+ MoM revenue growth; official GitHub Funding partner since 2024
- Open source: Yes (polarsource/polar on GitHub)

**Fees & Payments**
- Transaction fee: 4% + $0.40 (no monthly fee)
- International card surcharge: +1.5%
- Payouts: Manual (you trigger), 4–7 days via Stripe Connect, to bank account
- No payout fee for US developers

**License Key Support**
- Built-in, API-based. UUID format with customizable prefix.
- Activation limit enforcement, deactivation API.
- Public validation endpoint — no authentication required from the client app. Designed for exactly this pattern (desktop app calls home on launch).
- No device fingerprinting or offline validation (acceptable for a $15–$25 niche app).

**Ratings**
- Trustpilot: ~9 reviews (statistically unreliable)
- G2: Not listed
- No meaningful public aggregate scores yet — platform is too new for large review samples

**Why it fits RRR**
- No approval friction reported
- GitHub-native features (supporter stats, Discord role automation, repo access benefits) are potential marketing assets for a streamer community
- Best balance of fee, license key API, and platform trustworthiness for launch stage
- Accel / Shopify founder backing gives confidence it won't vanish

**Currency & International Payment Support**
- Multi-currency pricing launched February 2026: set USD, EUR, GBP, AUD, CAD (and 80+ others) as separate prices on the same product. Buyers see the right currency at checkout based on their region. You must configure each currency price manually — it is not automatic FX conversion.
- Payment methods: Visa, Mastercard, Amex, Apple Pay, Google Pay. PayPal is planned but not live. iDEAL, SEPA, Klarna, UPI — not supported.
- **China:** No Alipay or WeChat Pay. Chinese buyers would need a Visa/Mastercard, which most don't use for online purchases. Real blocker for the Chinese market — irrelevant for a Western-focused streaming app.
- **For RRR's actual audience (US/EU/UK/CA/AU streamers):** Not an issue. Set EUR/GBP/AUD/CAD prices at launch and international buyers get a fully localized checkout experience with no foreign transaction fees.
- The "not enough currencies" criticism in developer forums comes from devs targeting India, Southeast Asia, or Latin America who need local APMs (UPI, PIX, etc.) — not a concern for a Twitch/Discord/OBS-focused audience.

**Maturity & Risk Assessment**

The "young platform" concern is valid, but Polar specifically mitigates the main failure modes:

- **Underfunded → shutting down:** $10M from Accel (June 2025) is not a scrappy bootstrapped startup. This is a VC-backed company with real runway.
- **Small team → support collapses:** A concern, and support ticket lag has been reported during growth surges. Not account freezes — just response time.
- **No track record → surprise payout holds:** Birk Jernström built and sold Tictail to Shopify — he has done this before and understands how to run a payments-adjacent business responsibly.
- **Platform disappears:** Open source (polarsource/polar on GitHub). If Polar ever shut down, the codebase is public; you'd have full visibility into the system and a migration path. Compare this to a closed-source platform going dark with your license database inside it.

Creem is where the maturity risk is more real (€1.8M pre-seed, 2-person team) — which is why it's the backup, not the primary pick.

**Concerns**
- Support response times have been flagged during growth surges (ticket lag, not account freezes or fund holds)
- Manual payout flow requires you to actively request transfers

---

### Creem.io ⭐ *Strong Backup*

**Company**
- Founded: 2021 (Armitage Labs OU, incorporated in Estonia)
- HQ: Tallinn / Randvere, Estonia
- Founders: Gabriel Ferraz and Alec Erasmus (both ex-Google, ex-Adyen)
- Funding: €1.8M (~$2.1M) pre-seed, August 2025 — led by Practica Capital; supported by Antler and angels from Revolut and Crypto.com
- Scale: Not publicly disclosed; ~€930K annualised revenue at funding time (2-person team)

**Fees & Payments**
- Transaction fee: 3.9% + $0.40 — lowest full-MoR rate available
- **US payout fee: 1% or $7 (whichever is higher).** This is not prominently disclosed.
  - On $500 payout: $7. On $1,000 payout: $10. Minimal if you batch payouts.
- Payouts: 1st and 15th of every month, bank transfer
- USD and EUR only (no multi-currency pricing)

**License Key Support**
- Built-in, API-based with activation limits and fraud prevention.

**Ratings**
- Trustpilot: ~14 reviews (statistically unreliable)
- AppSumo: 5.0/5 (3 reviews — not meaningful)
- No G2 / Capterra listings

**Why it fits RRR**
- Cheapest all-in fee for a full MoR
- No approval friction reported
- Founders with Adyen background means payments architecture is solid

**Concerns**
- Very new (2021 entity but serious traction only since ~2024)
- Small team; unknown support quality under load
- US payout fee; USD/EUR only
- No track record for payouts at scale

---

### Paddle

**Company**
- Founded: 2012
- HQ: London / Corby, UK
- Founders: Christian Owens (started at 18, left school at 16) and Harrison Rose
- Funding: ~$293M–$410M total. Key: Series D $200M (May 2022, KKR) at **$1.4B valuation**; $25M CIBC Innovation Banking (July 2025)
- Scale: 4,000+ software companies; processes $36B+ ARR across platform

**Fees & Payments**
- Transaction fee: 5% + $0.50
- FX markup: 2–3% on non-USD transactions
- Payouts: Weekly with 7–14 day initial holding period

**License Key Support**
- "Key list" model only — you pre-generate a batch of keys yourself (any UUID tool or script), upload them as a CSV, and Paddle pops the next one off the list and emails it to the customer on purchase.
- **There is no validation API.** Paddle has no concept of "is this key valid and how many times has it been activated?" — it just delivers a string. Your app cannot call Paddle to verify a key at launch.
- No activation limit enforcement, no deactivation, no device tracking.
- To get a real validation API with Paddle, you'd add a separate service alongside it (e.g. Keygen.sh): Keygen handles validation/activation tracking, Paddle handles payment. Two vendors, two integrations, two points of failure, added cost — versus Polar/Creem where key generation, delivery, and validation are all one system.

**Ratings**
- Trustpilot: 4.1/5 (10,143 reviews) — most reliable score of any platform here
- G2: 4.4/5 (1,165 reviews)
- Capterra: 3.5/5 (17 reviews — anomalously low; small sample)

**Verdict for RRR**
- Approval process takes days to weeks; prioritizes enterprise customers in support
- No license key API is a real gap
- The right answer at $5k+/month. Overkill for launch stage.

---

### Freemius

**Company**
- Founded: 2014
- HQ: Brooklyn, NY (fully remote; founder has Israeli background including intelligence unit)
- Founder: Vova Feldman (also founded RatingWidget, Senexx; former SAP Labs)
- Funding: **Bootstrapped — no external funding raised.** $8M annual revenue (2025).
- Scale: 2,000+ software makers; 1,700-member Slack community

**Fees & Payments**
- Transaction fee: 4.7% + Stripe gateway fees (~2.9% + $0.30 additional)
- All-in: approximately 7–8% per transaction
- Pricing tiers progressively drop to 0.5% over $100k/month
- Payouts: $100 minimum balance, bank transfer

**License Key Support**
- Best in class. Purpose-built for software licensing.
- Activation tracking, activation limits, remote deactivation, install entities, per-device analytics.
- Explicitly supports Windows desktop apps and Electron apps.

**Ratings**
- Trustpilot: ~2.5/5 (19 reviews — unreliable sample)
- G2: **4.7/5 (61 reviews)** — highest G2 score in this comparison
- Strong community reputation in WordPress/plugin developer circles

**Verdict for RRR**
- Best license key system available, hands down
- All-in fee (7–8%) is the price for that sophistication
- Originally WordPress-only; desktop app support is newer and less battle-tested
- Worth revisiting if license enforcement becomes a priority

---

### Gumroad

**Company**
- Founded: 2011
- HQ: San Francisco, CA, USA
- Founder: Sahil Lavingia (ex-Pinterest employee #2)
- Funding: ~$16.2M total (Seed $1.1M, Series A $7M led by Kleiner Perkins). No venture raised since ~2012; bootstrapped since.
- Scale: ~27,000 active creators; $23.8M revenue

**Fees & Payments**
- Transaction fee: 10% flat — includes Stripe/PayPal processing
- Became full MoR globally as of January 1, 2025 (significant upgrade)
- Payouts: Weekly (Fridays) via Stripe-connected bank or PayPal

**License Key Support**
- Basic. Generates a unique key per purchase; customers receive via email; validation API exists.
- No activation limits, no device binding, no deactivation. Anyone with a key can validate it from any machine.

**Ratings**
- Trustpilot: 1.3/5 (382 reviews) — skewed by end-buyer scam complaints against sellers, not platform quality
- G2: 4.2/5 (16 reviews)

**Verdict for RRR**
- Zero friction to set up; MoR status is now clean
- 10% fee is hard to justify — at $15/sale, you give Gumroad $1.50 vs $0.75 on Polar
- License key protection is trivially bypassed
- Reasonable for a quick demand validation, but not a long-term home

---

### Payhip

**Company**
- Founded: 2011 (incorporated Feb 2013)
- HQ: London, UK
- Founders: Not publicly prominent
- Funding: Bootstrapped — no funding disclosed
- Scale: ~130,000–370,000 creators (self-reported; range across sources)

**Fees & Payments**
- Payhip's cut: 5%
- Plus Stripe/PayPal processing: ~2.9% + $0.30
- All-in: ~7.9–8% per transaction
- MoR coverage: EU VAT, UK VAT, Australian GST handled. **US state sales tax is NOT fully covered** — liability remains with the seller beyond certain thresholds.

**License Key Support**
- Basic upload-based key delivery. Simple validation API.

**Ratings**
- Trustpilot: **4.5/5 (425 reviews)** — highest Trustpilot score in this comparison
- Capterra: 4.4/5 (23 reviews)

**Verdict for RRR**
- Best Trustpilot reputation of any platform here, which is notable
- The US sales tax gap is a real legal exposure for a US streamer audience
- Fee (7.9–8%) is mid-tier
- Not the right long-term home; better than Gumroad on reputation, worse on tax coverage

---

### Whop

**Company**
- Founded: 2021
- HQ: New York, NY, USA
- Founders: Steven Schwartz, Cameron Zoub, Jack Sharkey (met via a Facebook sneaker-reselling group)
- Funding: Series A $17M (Insight Partners, Jul 2023, ~$100M val); Series B $50M+ (Bain Capital Ventures, Jun 2024, ~$800M val); Tether $200M (Feb 2026). Total: $217M+
- Scale: 18.4M+ end-users; **183,628 sellers**; 258 sellers have earned $1M+ on platform

**Fees & Payments**
- Transaction fee: ~2.7% + $0.30 (domestic); +1.5% international; +1% FX conversion
- Headline fee is genuinely the lowest of any platform here
- MoR coverage: **Partial — not full global coverage.** VAT/GST handling is incomplete for some jurisdictions, including EU.
- Payouts: Via Stripe Connect; ~2 business days

**License Key Support**
- Built-in.

**Ratings**
- Trustpilot: 3.7/5 (2,560 reviews)

**Verdict for RRR**
- The 2.7% + $0.30 fee is tempting but the MoR gap is a deal-breaker
- EU VAT: selling to EU customers without proper handling means personal liability from transaction one. For a streamer app, EU customers are a certainty.
- Platform is community/subscription-first (Discord groups, trading signals, creator monetization) — not designed for desktop app licensing
- Skip unless/until Whop achieves full global MoR status

---

### FastSpring

**Company**
- Founded: 2005
- HQ: Santa Barbara, CA, USA (offices in Austin, Amsterdam, Singapore, UK, Canada)
- Ownership: PE-backed — majority investment from **Accel-KKR** (Feb 2018); strategic investment from **LLR Partners** (May 2026)
- Scale: 2,500+ companies; processes $1B+ in annual transactions

**Fees & Payments**
- Transaction fee: 5.9% + $0.95 (baseline) — no public pricing page; custom quotes required
- FX markup: 3.5–5.5% on non-USD
- All-in: approximately 7–9% per transaction
- Payouts: Monthly or custom arrangement

**License Key Support**
- Yes, solid.

**Ratings**
- Trustpilot: 3.6/5 (534 reviews)
- G2: 4.5/5 (204 reviews)
- Capterra: 4.5/5 (31 reviews)

**Verdict for RRR**
- No self-serve signup — requires a sales call. For a $15 Windows app, this is absurd friction.
- Target customer is a mid-market software company doing $100k+/month
- Fees punishing for small price points
- Definitively not for this use case

---

### Dodo Payments

**Company**
- Founded: 2023
- HQ: Bengaluru, India
- Founders: Rishabh Goel (CEO — ex-Wise, ex-Prodigy Finance) and Ayush Agarwal (CPO — previously founded Tournafest, an India esports platform)
- Funding: $1.1M pre-seed — Antler, 9Unicorns, Venture Catalysts; angels include ex-PayU, ex-Flipkart, ex-a16z
- Scale: Claims 3,500 Discord community members and "10,000+ sign-ups" — sign-up figures, not verified paying merchants. No audited transaction volume disclosed.

**Fees & Payments**
- Base transaction fee: 4% + $0.40
- **International cards/APMs surcharge: +1.5%** (applies to most of your buyers — EU, UK, etc.)
- Chargeback/dispute fee: **$30 per dispute** (highest of any platform in this comparison; $15 on Polar)
- Payout fee: Free if balance ≥ $1,000; **$5 if < $1,000**; $25 for USD SWIFT
- Payouts: Twice monthly; weekly available for "fast-growing accounts" at Dodo's discretion
- Refunds: $1 per refund
- Analytics add-on: $10/month (optional)

For a $15 sale to a US buyer: ~$1.00 (6.7%). To an EU buyer: ~$1.23 (8.2%). At a $10 price point this starts to bite.

**License Key Support**
- Full API — not just delivery. Activate, deactivate, and validate endpoints are all public (no API key required from the client app). Activation limits configurable per key. Keys tied to payment lifecycle: issued on purchase, revoked on refund.
- Functionally equivalent to Polar and Creem for RRR's needs.

**Ratings**
- Trustpilot: ~113 reviews, mixed-to-negative trend
- AppSumo: 2.3/5 (6 reviews — 2 five-star, 4 one-star)
- Product Hunt: 4.8/5 (21 reviews — early adopter skew)
- G2 / Capterra: Not listed

**Community Reputation**
- No meaningful Reddit or Hacker News presence — the absence of organic community discussion at volume is notable for a platform this age
- Positive reviews skew heavily toward Indian/emerging-market SaaS founders who previously couldn't access Paddle or Stripe — Dodo is specifically solving that problem and doing it well for that audience
- Negative reviews follow a pattern: funds accumulated → account flagged for "compliance review" → support unresponsive for days → funds frozen for up to 120 days → in some cases alleged non-payment. One AppSumo reviewer explicitly noted suspected fake positive reviews suppressing real complaints.
- Discord support described as fast for onboarding; slower or silent when compliance holds occur

**Important context: their blog**
Dodo publishes 350+ articles — heavily weighted toward "[Competitor] alternatives" and "[Platform] vs [Platform]" keyword pages. The scale (350+ articles on $1.1M raised) is AI-content-production volume. Several sources used in the earlier research in this doc turned out to be Dodo articles. Their comparison content is marketing, not independent analysis. Discount it accordingly.

**Verdict for RRR**
- The license key API is genuinely solid; the platform works
- The +1.5% international surcharge and $30 chargeback fee make it more expensive than Polar or Creem for a Western buyer base
- Fund-hold complaints are a real flag for a solo dev who cannot absorb 120-day holds on revenue
- The right pick if your buyers skew India/Southeast Asia (UPI, local APMs, better coverage there than Polar/Creem). Not the right pick for a US/EU streamer audience.
- Skip unless that geography argument applies

---

### Fungies.io

**Company**
- Founded: 2022
- HQ: Warsaw, Poland / Palo Alto, CA (conflicting; company appears to operate across both)
- Founder: Duke Vu (CEO & Co-Founder)
- Funding: $850K pre-seed — Outlier Ventures, Depo Ventures, CzechFounders.VC, StartupYard, Tatum, CV VC
- Scale: Not publicly disclosed

**Fees & Payments**
- Transaction fee: 5% + $0.50 (same as Paddle / Lemon Squeezy)
- Full MoR: Yes — 41+ countries covered
- Payouts: Via Stripe Connect (you connect your Stripe account); manual or automatic daily payouts; Instant Payouts supported to eligible bank accounts. First payout for new accounts: 7–14 days.

**License Key Support**
- Game keys only — CSV upload for Steam, GOG, Epic, PSN, Xbox Live codes.
- **No generalized license key API for desktop software.** There is no SDK or validation endpoint designed for a Windows application to call on launch.
- Could deliver a license key as a plain text file in a digital download, but no activation limit enforcement.

**Ratings**
- Trustpilot: **2.6/5 (~32 reviews)** — "Poor"
- G2: Listed; very low review count — not meaningful

**Community Reputation**
- No meaningful presence on Reddit, Hacker News, or Indie Hackers at any scale — consistent with a very young, small platform
- Positive: Discord-based support with fast human responses; clean checkout UX; transparent pricing; quick setup
- Negative (recurring pattern): PayPal funds held for months with no explanation; account suspensions without reason followed by refusal to pay out; Discord server used as primary support channel, then users kicked/restricted; KYC re-verification loops with no resolution

**Why it appeared in this research**
- Fungies publishes an active comparison blog (fungies.io/blog) that ranks well in search — several platform comparisons in this research used their articles as sources. They are a content-marketing-active company, which explains their search presence despite small scale.

**Verdict for RRR**
- Not designed for desktop app software licensing — game key CSV delivery is not a substitute for a license validation API
- Fund-hold and account-suspension pattern in reviews is concerning for a $850K pre-seed company with a small team
- Higher fee (5% + $0.50) than Polar or Creem with worse features
- Skip

---

### Lemon Squeezy ⛔ *Do Not Use*

**Company**
- Founded: 2020
- HQ: Remote (US-based founders)
- Acquired by **Stripe, July 26, 2024.** Team of 13 at acquisition; turned down a $50M Series A before selling. $1.4M total raised before acquisition.
- Post-acquisition: Platform transitioning to "Stripe Managed Payments" (public preview Feb 2026, 5% + $0.50 fee). Features like storefront builder, affiliates, and digital download delivery are NOT being ported.

**Fees & Payments**
- Transaction fee: 5% + $0.50 (base); real-world rates reported at 10–18% with add-ons
- Payouts: Weekly with holds; identity/account approval required before any payout

**License Key Support**
- Best in class — was the gold standard before Polar/Creem emerged

**Ratings**
- Trustpilot: **1.2/5 (~135 reviews)** — "Bad" — lowest score in this comparison

**Why It's a No-Go**
- Phil's experience (email rejection on custom domain) is a documented, widespread pattern. Lemon Squeezy's fraud detection flags legitimate business emails on custom domains as suspicious.
- Multiple Trustpilot reviews (2024–2025) describe being stuck in a 20-attempt verification loop with only "wait 24h" responses.
- Reported payout freezes of $2,000–$3,000+ for weeks/months with complete silence from support.
- Human support response time: 1–2 weeks.
- Stripe acquisition creates platform uncertainty: unknown roadmap, culture shift, and Stripe's documented history of account freezes for legitimate businesses.
- Building on LS today means rebuilding when it's absorbed into Stripe Managed Payments.

---

### Stripe (Direct) — No MoR

**Company**
- Founded: 2010
- Scale: Largest payment processor in this list by far; powers much of the internet
- Fee: 2.9% + $0.30 (US); +1.5% international; Stripe Tax addon ~0.5% (handles calculation only — not filing or remittance)

**Why It's a No-Go for Launch**
- No MoR: you ARE the merchant of record. All tax liability is yours.
- EU VAT: Must register from the first transaction. 27 countries, OSS scheme available but requires registration in at least one EU country.
- US sales tax: 400+ local rate changes in 2025 alone. Nexus thresholds in multiple states require registration, collection, and filing.
- No native license key delivery — build it yourself or bolt on a third party.
- Right choice for maximum control at scale with a dedicated tax/finance operation. Wrong choice for a solo dev at launch.

---

## Background Notes

### Why Trustpilot scores vary from G2 scores (e.g. Gumroad 1.3 vs 4.2)

Trustpilot captures reviews from end-buyers as well as sellers. Platforms like Gumroad and Lemon Squeezy have many negative Trustpilot reviews from customers who were scammed by sellers on the platform — which is a reflection of the platform's seller base and fraud controls, not necessarily the merchant experience. G2 captures verified B2B user reviews and is more reflective of what a software seller would experience. Both scores are informative for different reasons.

### Note on Dodo Payments

Several comparison articles used in this research were published by dodopayments.com — Dodo Payments is itself an MoR competitor that produces content marketing. Their articles were useful as aggregated research but should be read as coming from an interested party. Dodo Payments was not evaluated here due to very limited independent community data.

---

*Research conducted via web searches of Trustpilot, G2, Capterra, Crunchbase, Reddit, Hacker News, Indie Hackers, TechCrunch, and platform documentation. May 2026.*
