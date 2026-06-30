import LegalPageLayout from '@/components/LegalPageLayout';
import { getTranslations } from 'next-intl/server';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legalPages.cookiePolicy' });
  return buildPageMetadata({
    path: '/cookie-policy',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale,
  });
}

export default async function CookiePolicyPage() {
  const t = await getTranslations('legalPages.cookiePolicy');

  return (
    <LegalPageLayout
      title={t('title')}
      subtitle={t('subtitle')}
      lastUpdated={t('lastUpdated')}
    >
      <h2 className="text-corsair-blue-950 text-xl font-bold mt-0">1. What Are Cookies?</h2>
      <p>
        Cookies are small text files that are placed on your device (computer, tablet, or mobile phone) when you visit a website. They are widely used to make websites work more efficiently, provide a better user experience, and give website owners information about how their site is being used.
      </p>
      <p>
        Cookies are not harmful and do not contain viruses or personal information like credit card numbers. They simply help websites remember your preferences and understand how you interact with them.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">2. How We Use Cookies</h2>
      <p>
        Corsair Tactical Solutions uses cookies to enhance your browsing experience, analyze website traffic, and support our marketing efforts. We have organized our cookies into four categories based on their purpose:
      </p>

      <h3 className="text-corsair-blue-900 font-semibold">Essential Cookies (Always Active)</h3>
      <p>
        These cookies are strictly necessary for the website to function properly. They enable core features such as page navigation, form submission, and security. You cannot opt out of these cookies as the website cannot function without them.
      </p>
      <ul>
        <li>Session management and security tokens</li>
        <li>Cookie consent preference storage</li>
        <li>Form functionality and submission state</li>
        <li>Load balancing and server routing</li>
      </ul>

      <h3 className="text-corsair-blue-900 font-semibold">Analytics Cookies (Optional)</h3>
      <p>
        These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. This allows us to improve our website's performance and content.
      </p>
      <ul>
        <li>Google Analytics — tracks page views, session duration, and user behavior</li>
        <li>Performance monitoring — identifies slow-loading pages or errors</li>
        <li>Traffic source analysis — understands how visitors find our website</li>
      </ul>

      <h3 className="text-corsair-blue-900 font-semibold">Marketing Cookies (Optional)</h3>
      <p>
        These cookies are used to deliver advertisements that are relevant and engaging to you. They may also be used to limit the number of times you see an advertisement and measure the effectiveness of advertising campaigns.
      </p>
      <ul>
        <li>Facebook Pixel — enables targeted advertising on Facebook and Instagram</li>
        <li>Conversion tracking — measures the effectiveness of our advertising</li>
        <li>Retargeting pixels — allows relevant ads to be shown to previous visitors</li>
      </ul>

      <h3 className="text-corsair-blue-900 font-semibold">Functional Cookies (Optional)</h3>
      <p>
        These cookies enable enhanced functionality and personalization, such as remembering your language preferences or other settings you have chosen.
      </p>
      <ul>
        <li>Language preference storage</li>
        <li>Accessibility settings persistence (text size, contrast mode)</li>
        <li>Form pre-fill preferences</li>
        <li>User interface customization</li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">3. Your Cookie Choices</h2>
      <p>
        When you first visit our website, you will be presented with a cookie consent banner that allows you to:
      </p>
      <ul>
        <li><strong>Accept All Cookies</strong> — enable all cookie categories including analytics, marketing, and functional</li>
        <li><strong>Reject Non-Essential</strong> — accept only essential cookies required for the website to function</li>
        <li><strong>Manage Preferences</strong> — choose which specific categories of cookies you accept</li>
      </ul>
      <p>
        Your cookie preferences are stored in your browser's localStorage and will be remembered on subsequent visits. You can update your preferences at any time by clearing your browser data or contacting us.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">4. Third-Party Cookies</h2>
      <p>
        Some cookies on our website are placed by third-party services. These third parties have their own privacy policies and we have no control over their cookies. Third-party services we may use include:
      </p>
      <ul>
        <li><strong>Google Analytics</strong> — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-corsair-red-500 hover:underline">Google Privacy Policy</a></li>
        <li><strong>Facebook/Meta</strong> — <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-corsair-red-500 hover:underline">Meta Privacy Policy</a></li>
        <li><strong>Vercel Analytics</strong> — <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-corsair-red-500 hover:underline">Vercel Privacy Policy</a></li>
      </ul>

      <h2 className="text-corsair-blue-950 text-xl font-bold">5. Browser Cookie Controls</h2>
      <p>
        In addition to our cookie consent banner, most web browsers allow you to control cookies through their settings. You can set your browser to:
      </p>
      <ul>
        <li>Block all cookies</li>
        <li>Block third-party cookies only</li>
        <li>Clear cookies when you close the browser</li>
        <li>Notify you when cookies are being set</li>
      </ul>
      <p>
        Please note that blocking or deleting cookies may affect your experience on our website and some features may not work correctly. Refer to your browser's help documentation for instructions on managing cookies.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">6. Do Not Track</h2>
      <p>
        Some browsers transmit "Do Not Track" (DNT) signals to websites. We respect DNT signals and will not load optional tracking cookies when a DNT signal is detected, consistent with your cookie preferences.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">7. Updates to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data practices. Any changes will be posted on this page with an updated "Last Updated" date.
      </p>

      <h2 className="text-corsair-blue-950 text-xl font-bold">8. Contact Us</h2>
      <p>
        If you have questions about our use of cookies, please contact us at <a href="mailto:corsairtacticalsolutions@gmail.com" className="text-corsair-red-500 hover:underline">corsairtacticalsolutions@gmail.com</a> or call 214-335-6652.
      </p>
    </LegalPageLayout>
  );
}