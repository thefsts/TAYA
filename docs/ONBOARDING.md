# Client Site Onboarding

## What happens automatically today

Creating a site (`POST /api/sites`) now seeds everything a new client needs to
start editing immediately, with no manual database work:

- The site row itself (`sitesTable`), with modules defaulted from
  `defaultModulesForWebsiteType(websiteType)` unless explicitly overridden.
- An Operon Connector™ row (`crmConnectionsTable`), default-installed but
  disconnected until an admin adds credentials.
- Default homepage content (`homepageContentTable`) — placeholder hero
  headline/subheadline so the Homepage editor has a row to edit rather than a
  blank/broken state.
- Default footer content (`footerContentTable`) — placeholder copyright line.
- An empty contact info row (`contactInfoTable`) so the Contact Info page
  loads instead of 404/empty-state on first visit.
- A default SEO settings row for `/` (`seoSettingsTable`).
- A `client_admin` role assignment (`userSiteRolesTable`) for the creating
  user, unless the creator is a super admin (super admins can see all sites
  without a per-site role row).
- An activity log entry (`activityLogTable`) recording the site creation.

All of this lives in the `POST /api/sites` handler in
`artifacts/api-server/src/routes/sites.ts`.

## Why this exists

The Corsair Tactical Solutions onboarding (the platform's first production
client) was done by hand, and the homepage/footer/contact/SEO tables were
never seeded — the dashboard pages loaded into confusing empty states until
that gap was found and fixed manually. Auto-seeding on site creation closes
that gap permanently so it can't recur for the next client.

## Known manual steps (not yet automated)

These still require a human after site creation:

- Setting the real domain and verifying DNS/SSL (Website Status page reflects
  live health once the domain is set).
- Connecting the Operon Connector™ (CRM credentials) if the client uses it.
- Configuring Square payments, email sending, and any non-default enabled
  modules.
- Uploading a real logo, hero image, and replacing the placeholder homepage/
  footer copy with real content.
- Granting roles to additional client-side users beyond the initial creator.

Automating more of this (e.g. a guided onboarding wizard) is a candidate for
a future platform release, not v1.0.
