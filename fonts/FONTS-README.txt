RoofScan UK self-hosted web fonts
Added 8 Nov 2026, approved by Takhy Ndiaye Marrero (privacy clean-up: the site no longer loads fonts from Google's servers, so visitors' IP addresses are not sent to Google when a page opens).

Files in this folder
  fraunces-latin.woff2            Fraunces, upright, variable (opsz 9 to 144, wght 400 to 600), latin subset        67,388 bytes
  fraunces-latin-ext.woff2        Fraunces, upright, variable (opsz 9 to 144, wght 400 to 600), latin-ext subset    59,540 bytes
  fraunces-italic-latin.woff2     Fraunces, italic, weight 500 (opsz 9 to 144), latin subset                         42,116 bytes
  fraunces-italic-latin-ext.woff2 Fraunces, italic, weight 500 (opsz 9 to 144), latin-ext subset                     37,632 bytes
  geist-latin.woff2               Geist, upright, variable (wght 400 to 800), latin subset                           29,288 bytes
  geist-latin-ext.woff2           Geist, upright, variable (wght 400 to 800), latin-ext subset                       16,540 bytes
  fonts.css                       @font-face rules used by index.html, owner.html, agent-signup.html, agency-signup.html and contractor-apply.html
  OFL-Fraunces.txt                Fraunces licence (SIL Open Font Licence 1.1)
  OFL-Geist.txt                   Geist licence (SIL Open Font Licence 1.1)

theme.css, public.css and portal.css carry their own copy of the @font-face rules (same files, the same weights each file used to ask Google for). 404.html has its own small block with absolute /fonts/ paths because it can be shown at any address.
Browsers only download the files a page actually uses: most pages fetch just fraunces-latin.woff2 and geist-latin.woff2 (about 97 KB). The latin-ext and italic files are only fetched when a page shows those characters or italic Fraunces.

Where the files came from
  Downloaded once on 8 Nov 2026 from Google Fonts (fonts.gstatic.com), the official distribution of both families, by reading this css2 address:
  https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Geist:wght@400;500;600;700;800&display=swap
  These are the same files the site was already loading from Google, so the look does not change.
  Fraunces: Google Fonts version v38. Upstream project https://github.com/undercasetype/Fraunces (Google Fonts build from commit d6d385783609ceb11ac0f220f3abd9f1631c8a36). Copyright 2018 The Fraunces Project Authors.
  Geist: Google Fonts version v5. Upstream project https://github.com/vercel/geist-font (Google Fonts build from commit a6d260e6cbc07eafdfad438f33601fe3c38b1e6f). Copyright 2024 The Geist Project Authors.
  Licence texts copied from https://github.com/google/fonts (ofl/fraunces/OFL.txt and ofl/geist/OFL.txt).

SHA-256 of the font files
  48282a415ec22e31beaf0a0666e6fae0c8cbddcd0b1f6e729f27c3ade8a64e43  fraunces-latin.woff2
  f120089b9440f3e35a980a2137347b1851ad46ee4b8ad5c63b6c07e053fa40e2  fraunces-latin-ext.woff2
  84ddb2768e89ac3d265b79e74fc2c802307828e6a5bd4aca6d8a349f6eb22fa3  fraunces-italic-latin.woff2
  b0ae1066307d8a60076cff8e21eb5fb71750ec5343324c2182d090bd35758a2f  fraunces-italic-latin-ext.woff2
  9b6f5ff45b278c744b5f379a2c4ecbaf858a842b8eaf82ac8d21b699ca16c608  geist-latin.woff2
  58a6b173d5ca1dec92166ea3c6cb1a84a4144556d10928ac14e8e6b40e4787bd  geist-latin-ext.woff2

Licence
  Both families are under the SIL Open Font Licence 1.1: free to use, embed and self-host on a website, including commercially. Keep the OFL text files next to the fonts. The fonts must not be sold on their own. The files are unmodified (no renaming of the font itself, no subsetting beyond what Google Fonts already did).

Not included on purpose
  Cyrillic and Vietnamese subsets (Google offers them, but no page uses those characters). Geist italic (never used on the site).
