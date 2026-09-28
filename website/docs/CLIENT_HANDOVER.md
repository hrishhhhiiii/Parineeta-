# Parineeta website: client handover

This is the main document for the shop owner. It explains what the website is, which accounts you must own, and how to use the admin panel day to day. The other guides:

- [ADMIN_GUIDE.md](ADMIN_GUIDE.md): the full admin manual.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md): what to do when something goes wrong.

## Project

| Item | Value |
|---|---|
| Project name | Parineeta (পরিণীতা) website |
| Purpose | Shows Parineeta's hand-painted Bengali wedding pieces (crowns, kouto boxes, sets, custom work), with 3D product views, and takes enquiries by WhatsApp and email |
| Production website URL | [TO BE COMPLETED] (the domain is not set up yet) |
| Admin panel URL | `[website address]/admin` |
| Customer enquiry page | `[website address]/account` (optional customer sign-in) |
| Current status | **Built and tested on the developer's computer. NOT yet live.** The admin panel's online services (Supabase, GitHub, hosting) are **NOT CONFIGURED** yet. |
| Handover version / date | Code version: see the latest commit in the Git history. Document date: 2026-09-28 |

## Ownership

**Every account below should be created in the business's name and owned by you, not by the developer.** The developer should only be added as a collaborator or member, and removed when the work ends.

| Service | Purpose | Account Owner | Status |
|---|---|---|---|
| GitHub (private repository) | Stores the website's source code and runs the automatic "publish" build | [CLIENT] | NOT CONFIGURED (the code is only in a local Git repository on the developer's computer) |
| Hosting: Cloudflare Pages **or** Hostinger | Serves the website to visitors | [CLIENT] | NOT CONFIGURED (both options are prepared; choose one) |
| Supabase | Admin logins, saved content, uploaded photos, the enquiry inbox, customer sign-in | [CLIENT] | NOT CONFIGURED |
| Domain | The website address (for example `parineeta365.in`) | [CLIENT] | [TO BE COMPLETED] |
| Business email | Receives email enquiries and sends customer sign-in emails | [CLIENT] | Partly done. The shop email in the site's content is the owner's Gmail address. The email-sending service (Web3Forms key) is NOT CONFIGURED, and the email service for customer sign-in (for example Resend) is NOT CONFIGURED. |
| Social accounts (Instagram, Facebook, YouTube) | Links on the website | [CLIENT] | These already exist and are linked from the site. |

```text
CLIENT (owns everything)
│
├── GitHub          (developer = collaborator)
├── Supabase        (developer = project member)
├── Hosting         (developer = member, if needed)
├── Domain
├── Business Email
└── Social Accounts
```

No passwords or secret keys are written in any of these documents. Keep them in a password manager.

## How the website works (in plain words)

1. You change things in the **admin panel** and press **Save changes**. This saves a **draft**. Visitors don't see it yet.
2. You press **Preview** to see the website with your changes, on computer, tablet and phone sizes.
3. You press **Publish**. The website rebuilds itself automatically, and after about 2 minutes the top bar shows **Live ✓**. Only now can visitors see your changes.

The admin keeps your unsaved typing on the computer or phone you're using, so closing the tab by mistake doesn't lose it.

## Admin panel

### How to log in
1. Open `[website address]/login` (the footer's **Sign in** link goes there).
2. Enter your email and password, then press **Sign in**.
3. The website sends each person to the right place:
   - **owner:** the **Admin panel**, with everything, including Publish and Enquiries.
   - **editor:** the **Editor panel**. It's the same screens, but they can only save drafts. There's no Publish and no Enquiries.
   - **customers:** **My orders and enquiries**.
4. **Forgot password?** emails a link to choose a new password.
5. **Email me a sign-in link instead** signs you in without a password.

**Who gets which role:**
- Customers can create their own account with **Create an account**. It's optional, and they can always enquire without one.
- The owner and editors must be added by the developer. Their emails go in the `admins` list, with the role `owner` or `editor`, and their logins are created in Supabase → Authentication.

### How to change homepage content
1. Go to **Homepage text**.
2. The top part is the **hero**: the big headline, the line under it, the WhatsApp button text, the big photo and its caption.
3. Below it, every section has its own group:
   - its heading
   - the italic ending of the heading
   - its intro text
   - **Hide this whole section**
4. Save, then publish.

Other homepage parts have their own sections in the menu:
- Wedding story
- Bridal sets
- Lookbook photos
- Celebrity visits
- Services
- Customer reviews
- Announcement bar

The **order** of the sections can't be changed.

### How to add a product
1. In the left menu, choose **Products**.
2. Press **+ Add**.
3. Fill in these required fields (marked *):
   - Name (English)
   - Web address name
   - Category
   - Price from
   - Colourways
   - 3D shape
4. Add photos under **Photos and films**.
5. Press **Save changes**, and then **Publish**.

### How to edit a product
1. Go to **Products** and click the product in the list.
2. Change what you need.
3. Press **Save changes**, and then **Publish**.

### How to remove a product
- **To hide it and keep it for later:** tick **Hide from the site**, save, and publish.
- **To delete it:** select it, press **Delete**, confirm, save, and publish. Until you save, **Undo changes** brings it back.

### How to upload product images
In the product, under **Photos and films**:
1. Add a line, keep **Kind: Photo**, and choose the photo file.
2. The admin shrinks it automatically. Phone photos are fine.
3. The **first** photo is the one shown in the collection grid. Use **↑ Move up** to change the order.

### How to manage gallery images
The gallery is the **Lookbook photos** section. Add, reorder, caption or delete photos there, then save and publish.

The **Celebrity visits** section works the same way. Name a guest only with their permission.

### How to add a store
1. Go to **Shops and addresses** and press **+ Add**.
2. Fill in:
   - the shop name
   - the address (one line per row)
   - the phone numbers (one per line)
   - the opening hours (optional)
   - the **Map search**: what you'd type into Google Maps
3. Save, then publish.

### How to edit a store
Pick the shop in the list, change it, save, and publish.

The **first** shop with a map search is the one shown on the map.

### How to remove a store
- To remove it for good: select it, press **Delete**, then save and publish.
- To hide it for now: tick **Hide from the site**.

### How to change Instagram, Facebook or YouTube
1. Go to **Social media**.
2. Pick the link, and paste the full `https://` address of your page. You can also change the name shown under the link.
3. Save, then publish.

The website ignores a link that isn't on that platform's own website, for safety. These links also update the footer icons and what Google knows about the shop.

### How to manage videos
- **YouTube videos:**
  1. Go to **YouTube videos** and press **+ Add**.
  2. Paste the video's YouTube link and add a title.
  3. Save, then publish.

  The videos appear in the "Films and social" section. YouTube only loads when a visitor presses play. Use **↑ / ↓** to change the order, or **Hide from the site** to hide one.
- **The shop's own short films** come from a fixed library that is part of the website. Inside a product, you can choose one as a photo (Kind: Film). Adding new films of this kind needs a developer.

### How to change what Google shows
1. Go to **Google and sharing**. You can change:
   - the page title and description shown in Google
   - the title, text and picture shown when the site's link is shared on WhatsApp or Facebook
2. Save, then publish.

Google takes days or weeks to pick up changes.

### How to update contact information
Go to **Contact and payments**. You can change:
- the WhatsApp number (country code, digits only, e.g. `919064188260`)
- the shop email
- the email-sending key
- payment details: UPI, bank, a payment page link, pay at the shop, and the advance percentage

Save, then publish.

### How to preview changes
Press **Preview** in the top bar. The website opens inside the admin with your changes, including unsaved ones. Use **Desktop**, **Tablet** and **Mobile** to check each size. A small label says "Preview. Not live." Nobody else sees this.

### How to publish changes
Press **Publish** in the top bar (owner only), then confirm. Every saved section goes live together.

The top bar shows:
- "Updating the website…", and then "Live ✓ [time]", when it works.
- "Update failed" if something went wrong. Press **Retry update**. The live website stays as it was until an update succeeds.

### How to use "Set to Default"
- **One field:** in Homepage text, Contact and payments, Announcement bar and Google and sharing, a field you've changed shows **↺ Default**. It shows the current and original value before changing anything.
- **A whole section:** press **Set to default** in the save bar. You'll see how much will change. Confirming puts the section back to the website's original built-in content.
- Either way, **only your draft changes**. Press **Save changes**, then **Publish**, to make it live. Until you save, **Undo changes** brings your version back.

### How to go back to an earlier version
1. Press **History** in the save bar to see the saved versions of a section.
2. The owner can press **Restore** on one. It becomes the draft, and you press **Publish** to make it live.

## Customer enquiries

- When a customer sends an enquiry, their WhatsApp message and email include a private tracking link.
- Customers can also sign in at `/account` with just their email. This is optional.
- **Enquiries** in the menu (owner only) lists every enquiry: contact details, the items asked about, and the customer's note. It has one-tap WhatsApp and call links.
  - Change the **status** (New → Replied → Order confirmed → Being painted → Ready → Delivered, or Closed) and add a note the customer will see. Then press **Update**. The customer's tracking page shows it straight away, with no publishing needed.
  - **Download CSV** saves a spreadsheet of all enquiries.
- Enquiries are deleted automatically after 18 months. The inbox only works once Supabase is set up.

## HANDOVER CHECKLIST

### Accounts

- [ ] GitHub transferred
- [ ] Supabase transferred
- [ ] Hosting transferred
- [ ] Domain transferred
- [ ] Business email configured

### Website

- [ ] Production website working
- [ ] Admin panel working
- [ ] Admin login tested
- [ ] Products tested
- [ ] Gallery tested
- [ ] Stores tested
- [ ] Social links tested
- [ ] YouTube tested
- [ ] Contact information tested

### Technical

- [ ] Environment variables configured
- [ ] Database migrations verified
- [ ] Storage verified
- [ ] Production build verified
- [ ] Backup verified
- [ ] Recovery process tested

### Documentation

- [ ] Client guide delivered
- [ ] Developer documentation delivered
- [ ] Deployment guide delivered
- [ ] Troubleshooting guide delivered

### Final

- [ ] Client trained
- [ ] Client confirmed access
- [ ] Developer access reviewed
- [ ] Handover completed
