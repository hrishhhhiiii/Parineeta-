# Admin panel guide

The admin is at `[website address]/admin`. These are the sections that **actually exist**, in the order of the left menu:

```text
ADMIN PANEL
│
├── Top bar ........ Publish · Preview · Retry update · live status
├── Products
├── Categories
├── Bridal sets
├── Customer reviews
├── Contact and payments   (contact details + payment settings)
├── Lookbook photos        (the gallery)
├── Celebrity visits   
├── Services
├── Wedding story
├── Announcement bar
├── Homepage text          (hero + every section's heading and intro)
├── Shops and addresses    (stores)
├── Social media
├── YouTube videos
├── Google and sharing     (SEO)
└── Enquiries              (owner only; no publishing needed)
```

**Not in the admin:**
- a dashboard
- changing the **order** of homepage sections
- a screen for deleting stored photo files

## How every section works

| Question | Answer (the same for every section) |
|---|---|
| What happens after saving? | **Save changes** stores a **draft**, and the top bar shows "N sections not published yet". The live website does **not** change. |
| Is publishing required? | **Yes.** Only **Publish** (owner role) puts drafts on the live website. It publishes every saved section together, and takes about 2 minutes. |
| "Set to Default"? | **Set to default** (in the save bar) puts the whole section back to the built-in content. In one-page sections, **↺ Default** next to a changed field resets just that field. Both change your **draft** only: save, then publish. **Undo changes** discards unsaved edits. |
| Older versions | **History** lists the saved versions. The owner can **Restore** one as the draft, then publish it. |
| Unsaved edits | Kept on this device until you save or undo. A red dot in the menu marks sections with unsaved edits. |
| Two people editing | If someone else saved the same section first, your save is refused with a message. Copy your text, reload, and apply it again. |
| Preview | **Preview** shows your current edits (saved or not) inside the admin, at desktop, tablet and mobile widths. |

Lists (products, photos, reviews and so on) share these buttons: **+ Add**, **↑ Move up**, **↓ Move down**, **Duplicate** and **Delete**. The order in the admin is the order on the website.

## Products
1. **Controls:** the collection grid, the product pop-up, each product's own page (`/p/<web-address-name>/`), and the 3D gallery.
2. **You can change:**
   - English and Bengali names
   - web address name
   - category and price
   - one-line summary and full description
   - photos and films
   - colourways
   - options and add-ons with extra prices
   - days to make
   - whether the product can be personalised, and the hint shown to customers
   - 3D shape (and the painting, for the arched-panel shape)
   - hidden
3. **How:** go to Products, pick a product (or press + Add), edit it, save, and publish.
4. **Warnings:**
   - **Avoid changing the web address name** once a link has been shared. Old links stop opening that product.
   - A product with no colourway or 3D shape can't be saved.
   - Hidden products stay saved but don't appear on the site.
   - Deleting a product that a bridal set or story chapter uses removes it from those places when the site is built.

## Categories
1. **Controls:** the filter buttons above the collection.
2. **You can change:** the name (English and Bengali), the category code and a short description.
3. **Warning:** products point at the **category code**. Changing a code, or deleting a category, leaves those products without a matching filter. Move the products to another category first.

## Bridal sets
1. **Controls:** the bundles sold together at one price.
2. **You can change:** the name, the set code, the price, a one-line summary, the products in the set, and hidden.
3. **Warning:** a set with none of its products left on the site is hidden automatically.

## Customer reviews
1. **Controls:** the reviews shown on product pages.
2. **Warning:** **add only real reviews that customers sent you, with their permission.** Never invent reviews.

## Contact and payments
1. **Controls:** the WhatsApp number used by every WhatsApp button, the shop email, the email-sending key (Web3Forms) and the checkout payment options.
2. **You can change:**
   - WhatsApp number: digits with country code, 10–15 digits.
   - Shop email
   - Web3Forms key: this turns on "Send by Email". Get one free at web3forms.com.
   - Advance percentage
   - UPI ID and payee name
   - Bank account name, number, IFSC and bank name
   - Payment page link
   - Pay at the shop
3. **Warnings:**
   - A payment method with empty details is hidden at checkout.
   - Double-check the UPI ID and bank details before publishing, because customers pay into them.

## Lookbook photos (gallery)
1. **Controls:** the photography gallery.
2. **You can change:** the photos (uploaded from your device), their captions and their order.
3. **Warning:** deleting a photo from the list doesn't delete the file from storage (see [MEDIA_STORAGE_GUIDE.md](MEDIA_STORAGE_GUIDE.md)).

## Celebrity visits
1. **Controls:** photos of well-known visitors.
2. **You can change:** the photo, the caption and the guest name.
3. **Warning:** name a guest **only with their permission**.

## Services
1. **Controls:** the custom work tiles (backdrops, painted punjabi, mehendi and so on).
2. **You can change:** the name (English and Bengali), the code, the description, the photo and the tile size (standard, wide or tall).

## Wedding story
1. **Controls:** the chapters of the wedding-day story. Each chapter is linked to a product.
2. **You can change:** the moment, title and text, the linked product, and an optional real photo or film.
3. **Warning:** a chapter whose product was deleted is dropped from the site.

## Announcement bar
1. **Controls:** a thin strip across the top of every page.
2. **You can change:** show or hide it, the message, the link text and link, and optional "show from" and "hide from" dates.
3. **Warnings:**
   - The link must start with `https://`, `/` or `#`. Other links are removed for safety.
   - Keep the message to one line on a phone.

## Homepage text
1. **Controls:**
   - the hero: the Bengali strip line, the headline and its italic ending, the line under the headline, the WhatsApp button text, the big photo, the photo's description and its caption
   - for 11 sections (Celebrity visits, Wedding story, Film band, Collection, Bridal sets, Lookbook, Alpana studio, Invitation studio, Services, Films and social, Visit us): the heading, the italic ending, the intro, and whether the section is shown
2. **Warnings:**
   - Hiding a section also hides the menu and footer links that point to it.
   - Always describe a new hero photo, for blind visitors and for Google.

## Shops and addresses
1. **Controls:** the address and phone numbers in "Visit us", the map, and the "Get directions" button. The first phone number is also the one Google lists.
2. **You can change:** the name, address, phones, hours, map search and hidden, for each shop.
3. **Warnings:**
   - The **first** shop that has a map search sets the map.
   - With more than one shop, each shows its name and its own Directions link.
   - Hiding every shop hides the address, the map and the directions.

## Social media
1. **Controls:** the Instagram, YouTube and Facebook buttons in "Films and social", the footer icons, and the social links Google sees.
2. **Warning:** the link must be `https://` and on that platform's own website (for example `instagram.com`). Otherwise it's left out.

## YouTube videos
1. **Controls:** a grid of videos under "Films and social". It is not shown when the list is empty.
2. **You can change:** the YouTube link (any normal YouTube or youtu.be link works), the title, the order and hidden.
3. **Note:** the video thumbnail comes from YouTube. The player only loads, cookie-free, when the visitor presses play.

## Google and sharing (SEO)
1. **Controls:** the homepage's title and description in Google, and the title, description and picture used when the link is shared.
2. **Note:** these are written into the page when it's built, so Google sees them without running any scripts. Product pages build their own from each product.

## Enquiries (owner only)
1. **Controls:** the enquiry inbox, and the status customers see on their tracking link.
2. **How:**
   1. Filter by status.
   2. Set a status and an optional note (up to 500 characters) that the customer sees, then press **Update**.
   3. Use **Delete** to remove an enquiry for good, or **Download CSV** to save a spreadsheet.
3. **After saving:** the change is immediate. No publishing.
4. **Warning:** this is customers' personal data. Keep downloaded CSV files private.
