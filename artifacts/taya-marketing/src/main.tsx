import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const modules = [
  ['Website Control', 'Update content, services, products, events, forms, media, SEO, and more without touching code.'],
  ['Customer Operations', 'Keep customer activity, submissions, communications, and business records connected in one workspace.'],
  ['Growth Tools', 'Turn your website into an operating system for leads, reviews, campaigns, memberships, and new revenue.'],
  ['Health & Oversight', 'See site health, operational signals, backups, policies, and the work that needs attention.'],
];

function App() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#top" aria-label="TAYA home"><span className="brandMark">T</span><span>TAYA</span></a>
        <nav aria-label="Main navigation">
          <a href="#platform">Platform</a><a href="#how">How it works</a><a href="#business">For business</a>
        </nav>
        <a className="navCta" href="#contact">Get started</a>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow">THE BUSINESS WEBSITE COMMAND CENTER</div>
        <h1>Your website should <em>run the business</em>, not slow it down.</h1>
        <p className="lead">TAYA brings website management, customer operations, content, forms, growth tools, and day-to-day control into one clean workspace built for real businesses.</p>
        <div className="actions"><a className="primary" href="#contact">Build with TAYA <span>→</span></a><a className="secondary" href="#platform">Explore the platform</a></div>
        <div className="heroPanel" aria-label="TAYA dashboard preview">
          <div className="panelTop"><span className="miniBrand">TAYA</span><span className="status">● SYSTEM ONLINE</span></div>
          <div className="panelGrid">
            <div className="sideRail"><b>Command Center</b><span>Website</span><span>Customers</span><span>Content</span><span>Forms</span><span>Growth</span><span>Health</span></div>
            <div className="dashboard"><p className="kicker">BUSINESS OVERVIEW</p><h2>Everything important. One view.</h2><div className="stats"><article><small>Website</small><strong>Healthy</strong><i>All systems normal</i></article><article><small>New leads</small><strong>24</strong><i>Last 30 days</i></article><article><small>Content</small><strong>18</strong><i>Published items</i></article></div><div className="activity"><b>What needs attention</b><span><i>01</i> Review new customer submissions</span><span><i>02</i> Update upcoming events</span><span><i>03</i> Publish this week’s content</span></div></div>
          </div>
        </div>
      </section>

      <section className="proof"><div className="shell proofRow"><span>ONE PLATFORM</span><b>Website</b><b>Content</b><b>Customers</b><b>Operations</b><b>Growth</b></div></section>

      <section className="section shell" id="platform"><div className="sectionIntro"><span>BUILT TO REPLACE THE CHAOS</span><h2>One place to control the parts of your business that live online.</h2><p>No scattered admin panels. No calling a developer for every small update. TAYA is designed to give owners and teams useful control while protecting the underlying website and system.</p></div><div className="cards">{modules.map(([title, copy], i) => <article className="card" key={title}><span>0{i+1}</span><h3>{title}</h3><p>{copy}</p><a href="#contact">Learn more →</a></article>)}</div></section>

      <section className="split" id="how"><div className="shell splitGrid"><div><span className="sectionLabel">CONTROL WITHOUT THE RISK</span><h2>Give your team freedom without giving away the keys to the code.</h2></div><div className="steps"><article><b>01</b><div><h3>Connect the business</h3><p>TAYA organizes the website and operational tools around the way the business actually works.</p></div></article><article><b>02</b><div><h3>Manage from one dashboard</h3><p>Authorized users update the things they own while protected design and system boundaries stay intact.</p></div></article><article><b>03</b><div><h3>Grow without rebuilding</h3><p>Add capabilities as the business grows instead of replacing the entire website or workflow.</p></div></article></div></div></section>

      <section className="section shell business" id="business"><span className="sectionLabel">MADE FOR OPERATORS</span><h2>From “I need a website” to “my website works for me.”</h2><p>TAYA is built for businesses that need more than a brochure site: service companies, training organizations, professional firms, memberships, events, retail operations, and growing teams.</p></section>

      <section className="cta" id="contact"><div className="shell ctaInner"><div><span>READY TO PUT YOUR WEBSITE TO WORK?</span><h2>Run more of the business from one place.</h2></div><a href="mailto:contact@fullstacktechsolutions.com">Start with TAYA →</a></div></section>

      <footer><div className="shell footerGrid"><div><div className="brand"><span className="brandMark">T</span><span>TAYA</span></div><p>A website and business operations platform by Full Stack Tech & Solutions LLC.</p></div><div><b>Platform</b><a href="#platform">Features</a><a href="#how">How it works</a><a href="#business">Industries</a></div><div><b>Company</b><a href="#contact">Contact</a><a href="#top">Back to top</a></div></div><div className="shell copyright">© 2026 Full Stack Tech & Solutions LLC. All rights reserved.</div></footer>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
