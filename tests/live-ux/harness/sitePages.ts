/**
 * Test-site generator — the "customer website" the harness serves.
 *
 * REAL HTML for a fictional local business (Harborview Dental) served by
 * the harness's site origin. It is written so the REAL annotator
 * (convex/lib/editorAnnotate.ts collectBindings) derives the documented
 * §5 keys:
 *
 *   home.hero.heading            — <h1> first in body (homepage)
 *   home.hero.subheading         — first <p> with >=40 chars text
 *   home.hero.image              — first non-junk <img>
 *   home.hero.primaryButton.label— <a class="btn ..."> with CTA-ish label
 *   home.services.heading        — <section> whose <h2> matches services
 *   home.services.items[i].title — <li> cards in that section (ul>li >=2)
 *   home.services.items[i].description
 *   home.services.items[i].image
 *   home.faq.heading             — <section> with <h2> "Frequently asked"
 *   home.faq.items[i].title/.description — question/answer cards
 *   home.about.body              — single paragraph in the about section
 *   home.footer.text             — text content of <footer>
 *   home.headings[n].text        — positional headings
 *
 * Zone containers ([data-taya-zone]) exist in the site markup so the REAL
 * bridge snippet can place published blocks — mirroring how a customer
 * site embeds the snippet and gets §6 safe insertion zones.
 */

const heroImage =
  "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=70";

/** Rendered home page (path "/"). */
export function homePage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harborview Dental — Gentle care for your family</title>
<meta name="description" content="Family dentistry in Harbor City. Cleanings, whitening, and gentle emergency care.">
</head>
<body>
<header class="site-header">
  <nav class="site-nav">
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/faq">FAQ</a>
    <a href="https://facebook.com/harborviewdental">Facebook</a>
  </nav>
</header>
<main>
  <section class="hero">
    <h1>Welcome to Harborview Dental</h1>
    <p>Gentle, modern family dentistry in the heart of Harbor City — cleanings, whitening, and same-day emergency appointments for patients of every age.</p>
    <img src="${heroImage}" alt="Bright modern dental clinic reception" width="1200" height="600">
    <a class="btn btn-primary" href="/contact">Book an appointment</a>
  </section>

  <section class="services">
    <h2>Our services</h2>
    <p class="section-intro">Everything your family needs under one roof.</p>
    <ul class="card-list">
      <li>
        <h3>Checkups and cleanings</h3>
        <p>Thorough exams, digital X-rays, and a polish that leaves your smile bright.</p>
        <img src="https://images.unsplash.com/photo-1606811841689-23dfddce9325?w=600&q=60" alt="Dental hygienist cleaning a patient's teeth" width="600" height="400">
      </li>
      <li>
        <h3>Teeth whitening</h3>
        <p>Professional-strength whitening that brightens smiles by several shades.</p>
        <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=60" alt="Smiling patient after a whitening treatment" width="600" height="400">
      </li>
      <li>
        <h3>Emergency dentistry</h3>
        <p>Toothache? We keep same-day slots open so you are seen quickly.</p>
        <img src="https://images.unsplash.com/photo-1588776813646-1ffcce93237e?w=600&q=60" alt="Dentist examining a patient in a modern chair" width="600" height="400">
      </li>
    </ul>
    <div data-taya-zone="video-section"></div>
  </section>

  <section class="about">
    <h2>About our practice</h2>
    <p>We opened our doors in Harbor City in 2012 with one chair and a simple promise: dentistry that feels calm, honest, and unhurried. Today our team of five cares for more than two thousand families across the harbor district.</p>
  </section>

  <section class="faq">
    <h2>Frequently asked questions</h2>
    <ul class="faq-list">
      <li><h3>Do you take new patients?</h3><p>Yes — we welcome new patients every week and usually see first visits within two weeks.</p></li>
      <li><h3>Do you offer payment plans?</h3><p>We offer interest-free monthly plans and accept most major insurers.</p></li>
      <li><h3>Is parking available?</h3><p>Free patient parking is right beside the clinic entrance.</p></li>
    </ul>
    <div data-taya-zone="cta-stack"></div>
  </section>

  <section class="contact-cta">
    <h2>Book your visit today</h2>
    <a class="btn btn-cta" href="/contact">Contact us</a>
  </section>
</main>
<footer>
  <p>Harborview Dental · 42 Pier Street, Harbor City · (555) 210-4444</p>
</footer>
</body>
</html>`;
}

/** Rendered services page (path "/services"). */
export function servicesPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Services — Harborview Dental</title>
</head>
<body>
<header class="site-header">
  <nav class="site-nav">
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/faq">FAQ</a>
  </nav>
</header>
<main>
  <section class="services">
    <h2>Our services</h2>
    <p class="section-intro">A full range of treatments for the whole family.</p>
    <ul class="card-list">
      <li>
        <h3>Checkups and cleanings</h3>
        <p>Thorough exams, digital X-rays, and a polish that leaves your smile bright.</p>
        <img src="https://images.unsplash.com/photo-1606811841689-23dfddce9325?w=600&q=60" alt="Dental hygienist cleaning a patient's teeth" width="600" height="400">
      </li>
      <li>
        <h3>Teeth whitening</h3>
        <p>Professional-strength whitening that brightens smiles by several shades.</p>
        <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=600&q=60" alt="Smiling patient after a whitening treatment" width="600" height="400">
      </li>
      <li>
        <h3>Emergency dentistry</h3>
        <p>Toothache? We keep same-day slots open so you are seen quickly.</p>
        <img src="https://images.unsplash.com/photo-1588776813646-1ffcce93237e?w=600&q=60" alt="Dentist examining a patient in a modern chair" width="600" height="400">
      </li>
    </ul>
  </section>
  <div data-taya-zone="content"></div>
</main>
<footer>
  <p>Harborview Dental · 42 Pier Street, Harbor City · (555) 210-4444</p>
</footer>
</body>
</html>`;
}

/** Rendered FAQ page (path "/faq"). */
export function faqPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>FAQ — Harborview Dental</title>
</head>
<body>
<header class="site-header">
  <nav class="site-nav">
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/faq">FAQ</a>
  </nav>
</header>
<main>
  <section class="faq">
    <h2>Frequently asked questions</h2>
    <ul class="faq-list">
      <li><h3>Do you take new patients?</h3><p>Yes — we welcome new patients every week and usually see first visits within two weeks.</p></li>
      <li><h3>Do you offer payment plans?</h3><p>We offer interest-free monthly plans and accept most major insurers.</p></li>
      <li><h3>Is parking available?</h3><p>Free patient parking is right beside the clinic entrance.</p></li>
    </ul>
  </section>
  <div data-taya-zone="faq-list"></div>
</main>
<footer>
  <p>Harborview Dental · 42 Pier Street, Harbor City · (555) 210-4444</p>
</footer>
</body>
</html>`;
}

/** All pages of the test site, keyed by route path. */
export const SITE_PAGES: Record<string, () => string> = {
  "/": homePage,
  "/services": servicesPage,
  "/faq": faqPage,
};
