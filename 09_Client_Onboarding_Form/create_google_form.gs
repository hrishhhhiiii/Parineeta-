/**
 * =========================================================================================
 * GOOGLE APPS SCRIPT: AUTOMATIC GOOGLE FORM GENERATOR
 * Project: পরিণীতা (Parineeta) — Digital Transformation & E-Commerce Discovery
 * MNC-Grade Client Discovery & Digital Solution Onboarding Form
 * =========================================================================================
 * 
 * HOW TO RUN THIS SCRIPT IN 60 SECONDS:
 * 1. Open Google Drive (https://drive.google.com).
 * 2. Go to https://script.google.com/home/start (Google Apps Script).
 * 3. Click "+ New project".
 * 4. Delete any default code in Code.gs, and paste this ENTIRE script.
 * 5. Click the "Save" (disk icon) and then click the "Run" button at the top.
 * 6. Grant permission when prompted (standard Google Drive/Forms access).
 * 7. Check the Execution Log: It will output your LIVE Google Form Edit URL and Shareable Link!
 * =========================================================================================
 */

function createParineetaClientDiscoveryForm() {
  var formTitle = "পরিণীতা (Parineeta) — Digital Solution & Business Discovery Questionnaire";
  var form = FormApp.create(formTitle);

  form.setDescription(
    "Welcome to the official Digital Transformation & Solution Discovery phase for পরিণীতা (Parineeta) — 'এ যেন এক বিয়ের মরশুম'.\n\n" +
    "This comprehensive discovery questionnaire is designed by our Digital Strategy & Enterprise Architecture team to thoroughly understand your business model, customer journeys, catalog structure, and operational workflows. Your inputs will directly architect your custom online platform, e-commerce ecosystem, and digital growth roadmap.\n\n" +
    "⏱ Estimated completion time: 15–20 minutes.\n" +
    "🔒 Confidentiality: All commercial and operational data shared in this form is strictly confidential and protected under standard NDA."
  );

  form.setCollectEmail(true);
  form.setAllowResponseEdits(true);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);

  // =========================================================================
  // SECTION 1: EXECUTIVE & BUSINESS PROFILE
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 1: Executive & Business Profile")
      .setHelpText("Establishing foundational business entities, organizational hierarchy, and commercial positioning.");

  form.addTextItem()
      .setTitle("1.1 Official Registered Business / Entity Name")
      .setHelpText("Legal name of the entity as registered with authorities (e.g., Parineeta Bridal Creations Pvt. Ltd. / Proprietary).")
      .setRequired(true);

  form.addTextItem()
      .setTitle("1.2 Primary Point of Contact (SPOC) & Designation")
      .setHelpText("Full Name, Designation (e.g., Founder, Managing Director, Head of Operations).")
      .setRequired(true);

  form.addTextItem()
      .setTitle("1.3 Direct Contact Phone & WhatsApp Number")
      .setHelpText("Include country code (e.g., +91 98765 43210).")
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("1.4 Primary Commercial Business Model")
      .setHelpText("Select the primary architecture of your commercial transactions.")
      .setChoiceValues([
        "Direct-to-Consumer (B2C) — Retail Bridal Fashion & Lifestyle",
        "Business-to-Business (B2B) — Wholesale, Reseller & Bulk Orders",
        "Hybrid (B2C + B2B Wholesale)",
        "Service-Based (Wedding Planning, Decor, Event Management)",
        "Bespoke / Couture (Made-to-Order Custom Bridal Atelier)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("1.5 Brand Market Positioning & Price Tier")
      .setHelpText("How is the brand positioned relative to the market?")
      .setChoiceValues([
        "Ultra-Luxury / Haute Couture (Elite bridal trousseau, custom handloom, premium price points)",
        "Affordable Luxury / Premium (Accessible designer bridal wear with high heritage value)",
        "Mid-Market / Mass Prestige (High volume, festive & wedding collections for broader demographic)",
        "Multi-Tier (Budget-friendly essentials to high-end couture lines)"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("1.6 Current Physical Infrastructure")
      .setHelpText("Select all that apply.")
      .setChoiceValues([
        "Flagship Retail Store in Kolkata",
        "Branch Store(s) in other cities / districts",
        "Private Bridal Studio / By-Appointment Salon",
        "Manufacturing / Weaving / Embroidery Workshop",
        "Central Warehouse / Fulfillment Center",
        "Purely Online / Home-based at present"
      ])
      .setRequired(true);

  // =========================================================================
  // SECTION 2: PRODUCT CATALOG, SERVICES & INVENTORY
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 2: Product Catalog & Service Architecture")
      .setHelpText("Understanding your merchandise mix, customization capabilities, and SKU volumes.");

  form.addCheckboxItem()
      .setTitle("2.1 Core Product & Service Categories Offered")
      .setHelpText("Select all categories that will be featured on your digital platform.")
      .setChoiceValues([
        "Traditional Bridal Sarees (Banarasi, Katan, Baluchari, Tussar, Jamdani, Swarnachari)",
        "Bridal Lehengas & Fusion Gowns",
        "Groom Wear (Sherwani, Kurta-Jacket, Dhoti-Kurta Sets)",
        "Traditional Bengali Wedding Ornaments (Shola Mukut, Topor, Chandan sets)",
        "Shankha, Pola & Loha Badhano (Bridal Bangles & Jewelry)",
        "Trousseau Packaging, Dala & Gachkouto Collections",
        "Wedding Planning & Event Management Packages",
        "Bridal Makeover & Styling Consultation Services"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("2.2 Total Number of SKUs (Stock Keeping Units) at Launch")
      .setHelpText("Estimated number of individual products to be cataloged on the online store initially.")
      .setChoiceValues([
        "1 – 50 SKUs (Curated boutique collection)",
        "51 – 200 SKUs (Medium catalog size)",
        "201 – 500 SKUs (Comprehensive bridal collection)",
        "500+ SKUs (Extensive retail inventory with variations)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("2.3 Degree of Product Customization Offered")
      .setHelpText("Do your products require tailored measurements or custom craftsmanship?")
      .setChoiceValues([
        "Ready-to-Ship Only (Standard sizes / unstitched fabrics)",
        "Made-to-Order with Custom Sizing (Bespoke blouse tailoring, lehenga alterations)",
        "Full Couture Customization (Customer can customize fabric, color, zari, and embroidery)",
        "Hybrid (Combination of ready-to-wear and bespoke couture)"
      ])
      .setRequired(true);

  form.addParagraphTextItem()
      .setTitle("2.4 Key Seasonal Peak Cycles")
      .setHelpText("Detail your peak wedding sales months in the Bengali and Indian calendar (e.g., Boishakh, Agrahayan, Magh, Falgun, Durga Puja).");

  // =========================================================================
  // SECTION 3: TARGET AUDIENCE, GEOGRAPHY & MARKET EXPANSION
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 3: Target Audience, Demographics & Reach")
      .setHelpText("Defining customer personas, geographic priorities, and average transaction values.");

  form.addCheckboxItem()
      .setTitle("3.1 Target Geographic Footprint")
      .setHelpText("Where are your prospective digital customers located?")
      .setChoiceValues([
        "Local Hyper-local (Kolkata & Suburbs)",
        "Regional (West Bengal, Tripura, Assam, Eastern India)",
        "National Pan-India (Delhi NCR, Mumbai, Bengaluru, Pune, Hyderabad)",
        "International Bengali Diaspora (USA, UK, Canada, Australia, Singapore)",
        "Cross-Border (Bangladesh & South Asia)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("3.2 Expected Average Order Value (AOV) Online")
      .setHelpText("Anticipated average basket size per digital purchase.")
      .setChoiceValues([
        "Below ₹5,000 (Accessories, puja items, gifting)",
        "₹5,000 – ₹15,000 (Festive sarees, semi-bridal attire)",
        "₹15,000 – ₹45,000 (Pure silk bridal sarees, designer drapes)",
        "₹45,000 – ₹1,20,000 (Luxury bridal ensembles, groom sherwanis)",
        "Above ₹1,20,000 (Haute couture bespoke bridal sets)"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("3.3 Primary Customer Buying Personas")
      .setHelpText("Select the primary demographic segments driving purchasing decisions.")
      .setChoiceValues([
        "The Modern Bengali Bride (Ages 23–35, digital-first, discerning design taste)",
        "Parents & Elders of Bride/Groom (Focus on authenticity, pure silk certification, tradition)",
        "NRIs / Expatriates planning a destination wedding in India or abroad",
        "Wedding Guests & Bridesmaids shopping festive wardrobe",
        "Corporate / Luxury Gift Buyers"
      ])
      .setRequired(true);

  // =========================================================================
  // SECTION 4: DIGITAL PLATFORM, FEATURES & TECH STACK PREFERENCES
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 4: Digital Solution Architecture & Platform Features")
      .setHelpText("Selecting the functional capabilities, customer touchpoints, and integrations required.");

  form.addMultipleChoiceItem()
      .setTitle("4.1 Primary Digital Solution Type Desired")
      .setHelpText("What is the core vehicle of your digital presence?")
      .setChoiceValues([
        "Full E-Commerce Web Platform (Direct online purchase, shopping cart, checkout)",
        "Bridal Catalog & Appointment Booking Portal (High-end showcase with salon/video consultation booking)",
        "Hybrid Solution (E-commerce for ready items + appointment/inquiry booking for bridal couture)",
        "Digital Brand Showcase & Lead Generation Portal (Portfolio, stories, client acquisition)"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("4.2 Must-Have Advanced Customer Experience (CX) Features")
      .setHelpText("Select all features you consider critical for your online brand experience.")
      .setChoiceValues([
        "WhatsApp Business One-Click Chat & Styling Concierge",
        "Virtual Bridal Video Shopping Appointment Booking (Integrated calendar & video call link)",
        "Multi-Currency Display & Auto-Converter (INR, USD, GBP, EUR, BDT)",
        "Bespoke Blouse / Saree Measurement Submission Tool",
        "Real Wedding Stories & Bridal Lookbook Gallery",
        "Silk Mark / Handloom Authenticity Certification Badge Showcase",
        "Bridal Registry / Wishlist Sharing with Family",
        "Gift Wrapping & Custom Calligraphy Wedding Message Cards",
        "Customer Reviews, Video Testimonials & Photo Uploads"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("4.3 Preferred Technology Stack / CMS Platform (If any preference)")
      .setHelpText("We recommend best-fit based on scale, but please indicate if your team has a prior preference.")
      .setChoiceValues([
        "Shopify Plus / Shopify Advanced (Global gold standard for luxury fashion & cross-border)",
        "WooCommerce / WordPress (High customization, owned hosting, open-source)",
        "Custom Headless Next.js + Node.js (Enterprise grade, ultra-fast performance, bespoke UX)",
        "No preference — Rely entirely on your team's technical recommendation"
      ])
      .setRequired(true);

  // =========================================================================
  // SECTION 5: OPERATIONS, PAYMENTS, LOGISTICS & FULFILLMENT
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 5: Payments, Logistics & Operational Workflows")
      .setHelpText("Mapping transaction processing, domestic/international logistics, and policies.");

  form.addCheckboxItem()
      .setTitle("5.1 Domestic Payment Gateways & Methods Required")
      .setHelpText("Select payment modes to be enabled for Indian buyers.")
      .setChoiceValues([
        "UPI (Instant payment via PhonePe, Google Pay, Paytm, BHIM)",
        "Credit / Debit Cards (Visa, Mastercard, RuPay, Amex)",
        "Net Banking (All major Indian banks)",
        "No-Cost EMI / Cardless EMI / Buy Now Pay Later (BNPL)",
        "Cash on Delivery (COD) with verification OTP",
        "Bank Wire Transfer (NEFT/RTGS/IMPS for high-value couture)"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("5.2 International Payment Processing")
      .setHelpText("For overseas clients purchasing from USA, UK, Canada, UAE, etc.")
      .setChoiceValues([
        "International Credit Cards (via Razorpay International / Stripe)",
        "PayPal International Gateway",
        "Direct Swift Wire Transfer",
        "Not needed initially (Phase 1 will be domestic India only)"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("5.3 Courier & Shipping Logistics Status")
      .setHelpText("How do you currently or plan to handle order dispatch?")
      .setChoiceValues([
        "Already have existing courier tie-ups (e.g. Blue Dart, Delhivery, DTDC, DHL)",
        "Want automated multi-carrier aggregation integrated (e.g. Shiprocket, NimbusPost)",
        "Require guidance and end-to-end setup of shipping logistics and rate calculation",
        "Local store pickup / Click-and-Collect only initially"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("5.4 Return, Exchange & Alteration Policy Framework")
      .setHelpText("Luxury and bridal items typically maintain strict return guardrails.")
      .setChoiceValues([
        "Strict No Return / No Exchange (Common for bespoke bridal sarees & blouses)",
        "Exchange / Store Credit Only within 3–7 days (Condition: unused, tags intact)",
        "Complimentary Fit Alterations within 7 days, no monetary refunds",
        "Need digital consultants to draft standard bridal e-commerce legal policies"
      ])
      .setRequired(true);

  // =========================================================================
  // SECTION 6: BRAND ASSETS, CONTENT & PHOTOGRAPHY READINESS
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 6: Brand Assets, Media & Creative Readiness")
      .setHelpText("Evaluating digital assets, photography status, and brand identity materials.");

  form.addMultipleChoiceItem()
      .setTitle("6.1 Domain Name (URL) Status")
      .setHelpText("e.g., parineeta.com, parineetawedding.in, parineetabridal.com")
      .setChoiceValues([
        "We already own our preferred domain name",
        "We have identified a domain but need assistance purchasing and DNS setup",
        "We need your team to brainstorm and secure domain name options"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("6.2 High-Resolution Product Photography Status")
      .setHelpText("High-fashion visual presentation is the #1 conversion driver for bridal wear.")
      .setChoiceValues([
        "Fully Ready: Professional model shoots & ghost-mannequin catalog photos with white/transparent BG",
        "Partially Ready: High-quality showroom photos, but need professional post-processing & retouching",
        "Not Ready: Need photography art direction guidelines or shoot arrangement support",
        "We have sample images and will shoot the full collection during website development"
      ])
      .setRequired(true);

  form.addParagraphTextItem()
      .setTitle("6.3 Reference / Benchmark Websites or Brands You Admire")
      .setHelpText("Provide 2 to 4 links of brands (fashion, bridal, or e-commerce) whose aesthetic, user experience, or storytelling you admire (e.g., Sabyasachi, Tilfi, WeaverStory, Raw Mango).");

  // =========================================================================
  // SECTION 7: PROJECT GOVERNANCE, BUDGET TIER & TIMELINE
  // =========================================================================
  form.addPageBreakItem()
      .setTitle("Section 7: Project Governance, Budget & Launch Milestones")
      .setHelpText("Aligning milestones, investment parameters, and post-launch growth services.");

  form.addMultipleChoiceItem()
      .setTitle("7.1 Desired Launch Timeline Target")
      .setHelpText("When does the digital solution need to be live and accepting orders/bookings?")
      .setChoiceValues([
        "Urgent Sprint (3 to 4 Weeks — Fast-track launch before upcoming wedding season)",
        "Standard Professional Sprint (6 to 8 Weeks — Thorough UI/UX design, testing & catalog upload)",
        "Strategic Enterprise Phased Rollout (10 to 14 Weeks — Custom integrations, multi-currency, mobile app)",
        "Flexible / To be planned based on technical recommendations"
      ])
      .setRequired(true);

  form.addMultipleChoiceItem()
      .setTitle("7.2 Digital Solution Investment Allocation Tier (INR)")
      .setHelpText("Enables us to architect the optimal technology stack, payment tiers, and design fidelity.")
      .setChoiceValues([
        "Tier 1: ₹50,000 – ₹1,20,000 (Streamlined Shopify/WooCommerce setup with essential bridal features)",
        "Tier 2: ₹1,20,000 – ₹3,00,000 (Custom luxury UI/UX, advanced booking, multi-currency, WhatsApp API)",
        "Tier 3: ₹3,00,000 – ₹6,00,000+ (Enterprise omnichannel platform, bespoke animations, CRM & ERP integration)",
        "Open to discuss based on comprehensive solution proposal"
      ])
      .setRequired(true);

  form.addCheckboxItem()
      .setTitle("7.3 Post-Launch Digital Growth & Retainer Services Needed")
      .setHelpText("Select any ongoing services required after website launch.")
      .setChoiceValues([
        "Performance Marketing & Paid Ads (Meta Instagram/Facebook Ads, Google Search & Shopping Ads)",
        "Search Engine Optimization (SEO for bridal keywords: 'Bengali bridal saree online', etc.)",
        "Social Media Management & Creative Content Strategy",
        "Technical Maintenance, Server Hosting & Security Monitoring",
        "Monthly Catalog Management, Product Uploads & Banner Refresh"
      ]);

  form.addParagraphTextItem()
      .setTitle("7.4 Additional Notes, Specific Requests or Vision Statements")
      .setHelpText("Any unique custom requirements, legacy systems to integrate, or core brand philosophies you want to highlight.");

  // Output Links
  var formUrl = form.getPublishedUrl();
  var editUrl = form.getEditUrl();
  
  Logger.log("====================================================================");
  Logger.log("🎉 SUCCESS! GOOGLE FORM CREATED SUCCESSFULLY!");
  Logger.log("👉 SHAREABLE CLIENT LINK (Send to Client): " + formUrl);
  Logger.log("👉 EDIT / ADMIN LINK (To customize in Google Forms): " + editUrl);
  Logger.log("====================================================================");

  return {
    formUrl: formUrl,
    editUrl: editUrl
  };
}
