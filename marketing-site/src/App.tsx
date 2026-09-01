const features = [
  ["Website Management", "Build, manage and optimize approved website content without touching code."],
  ["Forms & Leads", "Capture inquiries, organize submissions and keep lead activity moving."],
  ["Automation", "Reduce repetitive work with smart operational workflows and lifecycle rules."],
  ["Media & Content", "Organize flyers, images, documents and approved content in one place."],
  ["Client Portals", "Give customers secure branded access with role-aware permissions."],
  ["Analytics & SEO", "Track site health, search visibility and operational performance."],
];

const stats = [["10K+", "Businesses Powered"], ["99.9%", "Uptime Reliability"], ["50+", "Powerful Features"], ["24/7", "Expert Support"]];

export default function App() {
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="#top" aria-label="TAYA home">
          <span className="taya-mark" aria-hidden="true"><i /><b /></span>
          <span className="brand-name">TAYA</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#platform">Platform</a><a href="#solutions">Solutions</a><a href="#industries">Industries</a><a href="#pricing">Pricing</a><a href="#resources">Resources</a><a href="#about">About</a>
        </nav>
        <div className="header-actions"><a className="login" href="/sign-in">Login</a><a className="button button-small gradient" href="#contact">Request Demo →</a></div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="pill">ALL-IN-ONE WEBSITE OPERATIONS PLATFORM</div>
            <h1>Everything You Need<br />to <span>Grow & Automate</span><br />Your Business</h1>
            <p>TAYA brings your website tools, client operations, forms, content and workflows together — so your organization can save time, work smarter and scale with confidence.</p>
            <div className="actions"><a className="button primary" href="#contact">Request a Demo →</a><a className="button outline" href="#platform">Explore TAYA</a></div>
            <div className="checks"><span>✓ Protected Design</span><span>✓ Controlled Client Access</span><span>✓ Automated Workflows</span></div>
          </div>

          <div className="visual-wrap" aria-label="TAYA dashboard preview">
            <div className="blob blob-one" /><div className="blob blob-two" />
            <div className="laptop">
              <div className="screen">
                <aside><div className="mini-brand"><span className="taya-mark tiny"><i /><b /></span>TAYA</div><strong>Dashboard</strong><span>Websites</span><span>Clients</span><span>Forms & Leads</span><span>Automation</span><span>Media Library</span><span>Analytics</span><span>Settings</span></aside>
                <div className="dash"><div className="dash-title">Dashboard <span>⌕ ◦ ●</span></div><div className="metric-row"><article><small>Active Sites</small><b>248</b><em>+19%</em></article><article><small>Open Leads</small><b>1,842</b><em className="orange">+22%</em></article><article><small>Automations</small><b>86</b><em className="orange">+12%</em></article><article><small>Activity</small><b>24.5K</b><em>+28%</em></article></div><div className="dash-grid"><article><b>Recent Activity</b><p>New form submission</p><p>Website content published</p><p>New client added</p></article><article className="chart"><b>Performance Overview</b><div className="chart-lines">⌁╱╲╱╲╱╱</div></article><article><b>Top Websites</b><p>ACME Plumbing · 12.4K</p><p>Elite Fitness · 8.7K</p><p>Green Spaces · 6.2K</p></article><article><b>Top Automations</b><p>Welcome Email · 1,245</p><p>Lead Follow-Up · 986</p><p>Event Lifecycle · 754</p></article></div></div>
              </div><div className="base" />
            </div>
            <div className="phone"><div className="phone-top" /><b>Dashboard</b><small>Total Clients</small><strong>248</strong><small>Open Leads</small><strong>1,842</strong><small>Activity</small><strong>24.5K</strong><div className="mini-chart">⌁╱╲╱╱</div></div>
          </div>
        </section>

        <section id="solutions" className="feature-strip">{features.map(([title, copy], i) => <article key={title}><span className={`icon i${i}`}>{["▣","◇","✣","▤","♙","▥"][i]}</span><div><b>{title}</b><p>{copy}</p></div></article>)}</section>
        <section className="stats">{stats.map(([value,label],i)=><article key={label}><span>{["🚀","♢","☆","◉"][i]}</span><div><b>{value}</b><p>{label}</p></div></article>)}</section>

        <section id="platform" className="section platform">
          <div><div className="label">ONE OPERATIONAL LAYER</div><h2>Your site stays professionally built. Your team gets safe controls.</h2><p>TAYA separates site ownership and engineering from daily content operations. Clients can keep websites current without changing layouts, breaking code or bypassing the approved design system.</p></div>
          <div className="mini-grid"><article><span>🔒</span><b>Design Lock™</b><p>Code, layout and protected styling stay under administrative control.</p></article><article><span>▦</span><b>Structured CMS</b><p>Purpose-built content tools instead of an unrestricted page builder.</p></article><article><span>⚡</span><b>Automation</b><p>Rules for dated content, capacity, publishing and operational state.</p></article><article><span>◎</span><b>Multi-Site Ready</b><p>Operate multiple client properties with tenant-aware controls.</p></article></div>
        </section>

        <section id="industries" className="section soft"><div className="label">BUILT FOR REAL OPERATIONS</div><h2>One platform. Many business models.</h2><p className="lead">Designed for organizations that need a great website and a controlled operational system behind it.</p><div className="industry-grid">{["Training & Education","Professional Services","Membership Organizations","Multi-Location Businesses"].map((x)=><article key={x}><span>→</span><b>{x}</b></article>)}</div></section>

        <section id="contact" className="cta"><div><div className="eyebrow">SEE TAYA IN ACTION</div><h2>Give clients control without giving away the keys to the code.</h2><p>Talk with Full Stack Tech & Solutions LLC about deploying TAYA for your website operations and client workflows.</p></div><a className="button light" href="mailto:amorebey@gmail.com?subject=TAYA%20Demo%20Request">Request Demo →</a></section>
      </main>

      <footer><div className="footer-brand"><div className="brand white"><span className="taya-mark"><i /><b /></span><span className="brand-name">TAYA</span></div><p>Tools. Automation. Your Advantage.</p><p>A Full Stack Tech & Solutions LLC platform for secure website operations and business-ready digital workflows.</p></div><div><b>Platform</b><a href="#platform">Overview</a><a href="#solutions">Solutions</a><a href="#industries">Industries</a></div><div><b>Company</b><a href="#contact">Request Demo</a><span>Full Stack Tech & Solutions LLC</span></div><small>Copyright © {new Date().getFullYear()} Full Stack Tech & Solutions LLC. All Rights Reserved.</small></footer>
    </div>
  );
}
