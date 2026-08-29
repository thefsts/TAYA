const features = [
  ["Website Operations", "Update approved content, services, products, FAQs and site information without touching source code."],
  ["Events & Classes", "Manage schedules, capacity and registrations with lifecycle-aware controls for full and past events."],
  ["Forms & Leads", "Create controlled forms and keep customer inquiries organized in one operational workspace."],
  ["Media & Flyers", "Publish approved photos, documents and flyers through a governed media workflow."],
  ["SEO Controls", "Maintain search-facing content without exposing the underlying application or locked layout system."],
  ["Client Portals", "Give customers secure, role-aware access to the website operations they are authorized to manage."],
];

export default function App() {
  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="#top" aria-label="TAYA home"><span className="mark">T</span><span><strong>TAYA™</strong><small>Website Operating System</small></span></a>
        <nav><a href="#platform">Platform</a><a href="#features">Capabilities</a><a href="#security">Security</a><a href="#contact">Demo</a></nav>
        <a className="button button-small" href="#contact">Request Demo</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">Technology • Automation • Yield • Administration</div>
            <h1>Run your website like a business system.</h1>
            <p>TAYA gives organizations a secure command center for website content, events, forms, media, SEO and client operations—without giving everyday users access to the code or locked design system.</p>
            <div className="actions"><a className="button" href="#contact">Request a Demo →</a><a className="button secondary" href="#platform">Explore TAYA</a></div>
            <div className="checks"><span>✓ Protected layouts</span><span>✓ Role-based access</span><span>✓ Operational automation</span></div>
          </div>
          <div className="dashboard-card">
            <div className="card-head"><span><b>TAYA COMMAND CENTER</b><small>Website operations overview</small></span><span className="shield">✓</span></div>
            <div className="stats"><div><b>12</b><span>Active Sites</span></div><div><b>24</b><span>Open Forms</span></div><div><b>18</b><span>Upcoming Events</span></div><div><b>486</b><span>Media Assets</span></div></div>
            <div className="automation"><b>Automated lifecycle controls</b><p>Full classes close automatically. Past events move out of active listings. Your team stays in control without repetitive cleanup.</p></div>
          </div>
        </section>

        <section className="trust"><span>Content management</span><span>Operational workflows</span><span>Client portal controls</span><span>FSTS administrative oversight</span></section>

        <section id="platform" className="section split"><div><div className="label">ONE OPERATIONAL LAYER</div><h2>Your site stays professionally built. Your team gets safe controls.</h2><p>TAYA separates site ownership and engineering from day-to-day content operations. Clients can keep their website current without accidentally changing layouts, breaking code or bypassing the design system.</p></div><div className="mini-grid"><article><b>Design Lock</b><p>Code, layout and protected styling remain under controlled administrative ownership.</p></article><article><b>Structured CMS</b><p>Manage approved sections through purpose-built tools instead of a generic page builder.</p></article><article><b>Automation</b><p>Reduce repetitive maintenance with rules for dated content, capacity and operational state.</p></article><article><b>Multi-Site Ready</b><p>Operate multiple client properties from a consistent platform with tenant-aware controls.</p></article></div></section>

        <section id="features" className="section alt"><div className="label">CORE CAPABILITIES</div><h2>Everything clients need to keep the site moving.</h2><p className="lead">TAYA turns common website maintenance into clear, governed workflows instead of developer tickets and risky direct edits.</p><div className="feature-grid">{features.map(([title, copy]) => <article key={title}><span className="feature-icon">◆</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>

        <section id="security" className="section security"><div className="dark-card"><div className="shield-large">✓</div><h2>Built around controlled access—not unrestricted editing.</h2><p>TAYA is designed so authorized users can operate the website while sensitive administrative, code and design controls stay protected.</p><ul><li>Your website design and code remain protected.</li><li>Clients update only authorized content and tools.</li><li>Time-sensitive classes and events can close and archive automatically.</li><li>FSTS administrators retain oversight and platform controls.</li></ul></div><div><div className="label">OPERATIONAL INTELLIGENCE</div><h2>Less manual website cleanup.</h2><p>Classes and events should not stay open forever. TAYA can use dates and capacity to help close active registration and transition old listings into past-event states automatically.</p><div className="callout"><b>Lifecycle-aware content</b><p>Designed for classes, training providers, events, service businesses, memberships and organizations where website information changes on a schedule.</p></div></div></section>

        <section id="contact" className="cta"><div><div className="eyebrow">SEE TAYA IN ACTION</div><h2>Give clients control without giving away the keys to the code.</h2><p>Talk with Full Stack Tech & Solutions LLC about deploying TAYA for your website operations and client workflows.</p></div><a className="button light" href="mailto:amorebey@gmail.com?subject=TAYA%20Demo%20Request">Request Demo →</a></section>
      </main>

      <footer><div><span className="mark">T</span><strong>TAYA™ Website Operating System</strong><p>A Full Stack Tech & Solutions LLC platform for secure website operations, controlled client management and business-ready digital workflows.</p></div><div><b>Platform</b><a href="#features">Capabilities</a><a href="#security">Security</a></div><div><b>Company</b><a href="#contact">Request Demo</a><span>Full Stack Tech & Solutions LLC</span></div><small>Copyright © {new Date().getFullYear()} Full Stack Tech & Solutions LLC. All Rights Reserved.</small></footer>
    </div>
  );
}
