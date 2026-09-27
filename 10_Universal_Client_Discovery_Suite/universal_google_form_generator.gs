/**
 * =========================================================================================
 * UNIVERSAL MNC-GRADE CLIENT DISCOVERY & DIGITAL TRANSFORMATION FORM GENERATOR
 * Industry-Agnostic Google Form Builder (Works for Any Business or Client)
 * =========================================================================================
 * 
 * Instructions:
 * 1. Open https://script.google.com and click "+ New Project".
 * 2. Paste this entire script into Code.gs.
 * 3. Click "Save" and then "Run" (createUniversalClientDiscoveryForm).
 * 4. The script creates an enterprise-grade discovery form in your Google Drive and logs the links!
 * =========================================================================================
 */

function createUniversalClientDiscoveryForm() {
  var formTitle = "Enterprise Client Discovery & Digital Solution Scoping Questionnaire";
  var form = FormApp.create(formTitle);

  form.setDescription(
    "Welcome to the formal Business Architecture & Digital Transformation Discovery Phase.\n\n" +
    "This questionnaire is designed by our Digital Strategy & Enterprise Consulting Practice to capture your core business model, target customer personas, operational workflows, and technology requirements. Your answers provide the foundational blueprint for architecting your digital solution, technology stack, and go-to-market execution.\n\n" +
    "⏱ Estimated completion time: 15–20 minutes.\n" +
    "🔒 Confidentiality: All operational, financial, and strategic information shared herein is strictly confidential."
  );

  form.setCollectEmail(true);
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // -------------------------------------------------------------------------
  // SECTION 1: ENTERPRISE OVERVIEW & BUSINESS MODEL
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 1: Enterprise Overview & Commercial Model")
      .setHelpText("Establishing legal corporate structure, commercial model, and market positioning.");

  form.addTextItem()
      .setTitle("1.1 Registered Company / Brand Name")
      .setHelpText("Legal name of the entity as registered with authorities.")
      .setRequired(true);

  form.addTextItem()
      .setTitle("1.2 Primary Point of Contact (SPOC) & Corporate Title")
      .setHelpText("Full Name, Designation (e.g., Founder, CEO, Chief Digital Officer, Project Lead).")
      .setRequired(true);

  form.addTextItem()
      .setTitle("1.3 Contact Email & Phone Number")
      .setHelpText("Official email and direct phone/WhatsApp number.")
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("1.4 Primary Industry / Business Sector")
      .setHelpText("Select the primary industry vertical your business operates in.")
      .setChoiceValues([
        "E-Commerce, Fashion & Retail (D2C / Consumer Goods)",
        "B2B Products, Manufacturing & Industrial Supply",
        "Professional Services (Consulting, Legal, Finance, Agency)",
        "SaaS, Software & Digital Tech Platforms",
        "Healthcare, Wellness, Medical & Pharmaceuticals",
        "Hospitality, Travel, F&B & Event Management",
        "Education, EdTech & Professional Training",
        "Real Estate, Construction & Architecture",
        "Other Specialized Industry"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("1.5 Core Commercial Operating Model")
      .setHelpText("How does your business primarily transact with customers?")
      .setChoiceValues([
        "B2C (Business-to-Consumer / Direct-to-Consumer)",
        "B2B (Business-to-Business Corporate Accounts)",
        "Hybrid (B2B + B2C Dual Stream)",
        "Two-Sided Marketplace / Aggregator Platform",
        "Subscription / Retainer / Recurring Membership Model",
        "Service-Based / Project-Based Billing"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("1.6 Current Business Lifecycle Stage")
      .setHelpText("Current scale and operational maturity.")
      .setChoiceValues([
        "Early-Stage Startup / Pre-Launch Venture",
        "Established Offline Business Transitioning to Digital",
        "Growing Digital Brand Scaling to Next Tier",
        "Mature Enterprise Undergoing System Modernization / Replatforming"
      ])
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 2: PRODUCTS, SERVICES & VALUE PROPOSITION
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 2: Products, Services & Value Proposition")
      .setHelpText("Defining your catalog, services, unique differentiators, and volume metrics.");

  form.addParagraphTextItem()
      .setTitle("2.1 Primary Products / Services Portfolio Description")
      .setHelpText("Describe your core offerings, key categories, and what makes your value proposition unique in the market.")
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("2.2 Total Catalog Size / SKU Volume at Launch")
      .setHelpText("Total number of distinct products, packages, or services to be digitally offered.")
      .setChoiceValues([
        "1 – 25 Items (Curated boutique / specialized service portfolio)",
        "26 – 100 Items (Moderate catalog size)",
        "101 – 500 Items (Comprehensive commercial inventory)",
        "500+ Items (High-volume enterprise catalog with complex variations)",
        "Not applicable (Pure SaaS / custom service contracts)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("2.3 Degree of Product / Service Customization")
      .setHelpText("Does the offering require custom scoping, bespoke tailoring, or configuration?")
      .setChoiceValues([
        "Standard / Fixed (Ready-to-buy, off-the-shelf, no customization)",
        "Semi-Customizable (Configurable options, add-ons, tier selection)",
        "Fully Bespoke (100% custom quoted, tailor-made per client request)",
        "Hybrid (Standard catalog + custom bespoke tier)"
      ])
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 3: TARGET AUDIENCE & MARKET DEMOGRAPHICS
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 3: Target Audience, Personas & Market Reach")
      .setHelpText("Identifying buyer personas, geographic boundaries, and average transaction sizes.");

  form.addParagraphTextItem()
      .setTitle("3.1 Primary Customer / Client Persona")
      .setHelpText("Who is the primary buyer? (e.g., Demographic details, corporate job titles, consumer habits, pain points solved).")
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("3.2 Geographic Target Market")
      .setHelpText("Select all target territories for this digital solution.")
      .setChoiceValues([
        "Local / City-Specific Metro Area",
        "Regional / State-Wide Territory",
        "National Pan-Country Reach",
        "International / Cross-Border Global Markets"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("3.3 Expected Average Transaction Value (AOV / Deal Size)")
      .setHelpText("Average transaction size in your primary operating currency.")
      .setChoiceValues([
        "Micro-Transactions / Budget (< ₹2,500 / < $50)",
        "Mid-Tier Commercial (₹2,500 – ₹15,000 / $50 – $200)",
        "Premium / High-Ticket (₹15,000 – ₹75,000 / $200 – $1,000)",
        "Enterprise / Luxury (> ₹75,000 / > $1,000 per order or contract)"
      ])
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 4: DIGITAL SOLUTION SCOPE & PLATFORM REQUIREMENTS
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 4: Digital Solution Architecture & Platform Requirements")
      .setHelpText("Specifying the digital vehicle, platform features, and user journey requirements.");

  form.addMultipleChoiceItem()
      .setTitle("4.1 Primary Digital Solution Type Needed")
      .setHelpText("What is the primary deliverable for this project?")
      .setChoiceValues([
        "Full E-Commerce Web Store (Direct sales, cart, online payment, shipping)",
        "Corporate Brand Website & High-Ticket Lead Generation Engine",
        "Client Portal / Membership Platform / Booking & Scheduling Engine",
        "Custom Web Application / SaaS Dashboard / Workflow Tool",
        "Mobile App (iOS & Android Native / Flutter / React Native)",
        "Enterprise Re-platforming & Systems Modernization"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("4.2 High-Priority Functional Capabilities")
      .setHelpText("Select all technical features required in the initial deployment phase.")
      .setChoiceValues([
        "Automated Online Payments & Invoicing",
        "Multi-Currency Display & Geolocation Currency Switcher",
        "Appointment Scheduling / Calendar Booking Integration",
        "Live Chat / WhatsApp Business CRM Automation",
        "User Account Dashboard / Order History / Wishlists",
        "Dynamic Quotation & Lead Estimation Calculator",
        "Customer Reviews, Rating System & Social Proof Wall",
        "Blog, Resource Center & Editorial Content Management (CMS)",
        "Multi-Language / Localization Support",
        "Role-Based Access Control (Admin, Staff, Customer tiers)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("4.3 Preferred Technology Stack / CMS (If Any)")
      .setHelpText("Indicate if your organization has an existing technology or hosting preference.")
      .setChoiceValues([
        "Shopify / Shopify Plus (Recommended for fast, reliable e-commerce)",
        "WordPress / WooCommerce (Recommended for content-heavy, flexible CMS)",
        "Custom Modern Web Stack (Next.js, React, Node.js, Tailwind CSS)",
        "Webflow (Recommended for high-design visual marketing sites)",
        "No preference — Recommend the optimal stack based on technical requirements"
      ])
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 5: OPERATIONS, PAYMENTS & THIRD-PARTY INTEGRATIONS
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 5: Operational Workflows, Payments & Integrations")
      .setHelpText("Mapping transaction processing, third-party software, and logistics/delivery.");

  form.addCheckboxItem()
      .setTitle("5.1 Payment Processing Methods Required")
      .setHelpText("Select all payment instruments you need to support.")
      .setChoiceValues([
        "UPI & Instant Mobile Wallets",
        "Credit Cards & Debit Cards (Visa, Mastercard, RuPay, Amex)",
        "Net Banking / Direct Bank Transfer",
        "International Payment Gateway (Stripe, PayPal, Multi-currency)",
        "Buy Now Pay Later (BNPL) / EMI Financing Options",
        "Automated Recurring Subscription Billing",
        "Cash on Delivery (COD) / Pay-on-Delivery with Verification",
        "Offline Invoicing / B2B Purchase Orders (PO)"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("5.2 Third-Party Software / Systems to Integrate")
      .setHelpText("Select any existing tools that need to sync with the new platform.")
      .setChoiceValues([
        "CRM (HubSpot, Salesforce, Zoho, LeadSquared)",
        "ERP / Inventory Management Software",
        "Email Marketing & Automation (Klaviyo, Mailchimp, Brevo)",
        "Shipping & Logistics Aggregator (Shiprocket, Delhivery, DHL, FedEx)",
        "Accounting / Invoicing (Zoho Books, Tally, QuickBooks)",
        "WhatsApp Business Cloud API / Automated Chatbots",
        "Analytics & Tracking (Google Analytics 4, Meta Pixel, Hotjar)",
        "No legacy integrations required (Clean slate deployment)"
      ])
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 6: BRAND ASSETS, CONTENT & CREATIVE READINESS
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 6: Brand Assets, Content & Creative Readiness")
      .setHelpText("Evaluating digital assets, photography status, and brand identity materials.");

  form.addMultipleChoiceItem()
      .setTitle("6.1 Brand Identity & Design System Status")
      .setHelpText("Do you have vector logos, color codes, and brand style guidelines ready?")
      .setChoiceValues([
        "Fully Ready: Vector logos, color palettes, fonts, and guidelines in hand",
        "Partially Ready: Have a logo file, but need full digital style guide & palette refinement",
        "Not Ready: Need complete brand identity design & creative direction"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("6.2 Written Copywriting & Visual Content Status")
      .setHelpText("Product photography, video assets, company bios, and service copy.")
      .setChoiceValues([
        "All Content Ready: High-res images, videos, and professional written copy prepared",
        "Partial Content: Have images, but require copywriting & content structuring assistance",
        "Need Full Assistance: Require creative copywriting, photography guidelines, or stock assets"
      ])
      .setRequired(true);

  form.addParagraphTextItem()
      .setTitle("6.3 Reference Benchmark Websites & Competitors")
      .setHelpText("Provide 2 to 4 website URLs of competitors or admired brands whose design, functionality, or user experience you wish to match or exceed.")
      .setRequired(true);

  // -------------------------------------------------------------------------
  // SECTION 7: PROJECT GOVERNANCE, BUDGET & TIMELINE
  // -------------------------------------------------------------------------
  form.addPageBreakItem()
      .setTitle("Section 7: Project Governance, Budget & Launch Milestones")
      .setHelpText("Aligning delivery milestones, resource commitments, and commercial parameters.");

  form.addMultipleChoiceItem()
      .setTitle("7.1 Target Go-Live Horizon")
      .setHelpText("When is the deployment expected to be fully live and operational?")
      .setChoiceValues([
        "Accelerated Sprint: 3 to 4 Weeks (Fast-track MVP launch)",
        "Standard Strategic Sprint: 6 to 8 Weeks (Comprehensive UX, testing, full catalog)",
        "Enterprise Phased Deployment: 10 to 16 Weeks (Complex integrations, custom apps)",
        "Flexible / Driven by optimal architecture recommendations"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("7.2 Digital Solution Investment Allocation Tier")
      .setHelpText("Enables our solutions architects to design the optimal scope and technology tiers.")
      .setChoiceValues([
        "Tier 1: Entry / Essential (₹50,000 – ₹1,50,000 / $700 – $2,000)",
        "Tier 2: Growth / Professional (₹1,50,000 – ₹3,50,000 / $2,000 – $5,000)",
        "Tier 3: Enterprise / Bespoke (₹3,50,000 – ₹8,00,000+ / $5,000 – $10,000+)",
        "Open to discuss based on comprehensive solution proposals"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("7.3 Post-Launch Growth & Retainer Services Needed")
      .setHelpText("Select any ongoing maintenance or growth support needed post-launch.")
      .setChoiceValues([
        "Continuous Cloud Hosting, Security & Technical Maintenance Retainer",
        "Search Engine Optimization (SEO) & Organic Visibility Growth",
        "Paid Performance Marketing (Meta Ads, Google Search & Shopping Ads)",
        "Conversion Rate Optimization (CRO) & User Analytics Audits",
        "Catalog Management, Content Updates & Feature Additions"
      ]);

  form.addParagraphTextItem()
      .setTitle("7.4 Special Strategic Vision or Custom Technical Notes")
      .setHelpText("Any proprietary workflows, compliance requirements, or specific strategic visions to share.");

  var formUrl = form.getPublishedUrl();
  var editUrl = form.getEditUrl();

  Logger.log("====================================================================");
  Logger.log("🎉 UNIVERSAL MNC DISCOVERY GOOGLE FORM CREATED SUCCESSFULLY!");
  Logger.log("👉 SHAREABLE CLIENT LINK: " + formUrl);
  Logger.log("👉 EDIT / ADMIN LINK: " + editUrl);
  Logger.log("====================================================================");

  return { formUrl: formUrl, editUrl: editUrl };
}
