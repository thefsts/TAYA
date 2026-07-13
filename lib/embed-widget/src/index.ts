export interface EmbedWidgetSettings {
  layout?: string;
  minRating?: number;
  maxPerPage?: number;
  showProviderBadge?: boolean;
  featuredOnly?: boolean;
  categoryFilter?: string;
}

export function generateEmbedSnippet(
  convexHttpUrl: string,
  slug: string,
  settings: EmbedWidgetSettings,
): string {
  const layout = settings.layout ?? "grid";
  const minRating = settings.minRating ?? 4;
  const maxCount = settings.maxPerPage ?? 12;
  const showBadge = settings.showProviderBadge ?? true;
  const featuredOnly = settings.featuredOnly ?? false;
  const categoryFilter = settings.categoryFilter ?? "";

  const endpointBase = `${convexHttpUrl}/api/public/reviews?slug=${slug}`;
  const endpoint = categoryFilter
    ? `${endpointBase}&category=${encodeURIComponent(categoryFilter)}`
    : endpointBase;

  return `<!-- FSTS Website Reviews Widget -->
<div id="fsts-reviews-widget"></div>
<script>
!function(){
  var ENDPOINT = '${endpoint}';
  var LAYOUT = '${layout}';
  var MIN_RATING = ${minRating};
  var MAX_COUNT = ${maxCount};
  var SHOW_BADGE = ${showBadge};
  var FEATURED_ONLY = ${featuredOnly};
  var CATEGORY = '${categoryFilter.replace(/'/g, "\\'")}';

  var CSS = [
    '#fsts-reviews-widget{font-family:inherit;box-sizing:border-box}',
    '#fsts-reviews-widget *{box-sizing:border-box}',
    '.fsts-rv-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}',
    '.fsts-rv-list{display:flex;flex-direction:column;gap:12px}',
    '.fsts-rv-masonry{columns:2 280px;gap:16px}',
    '.fsts-rv-masonry .fsts-rv-card{break-inside:avoid;margin-bottom:16px}',
    '.fsts-rv-carousel,.fsts-rv-slider{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:8px}',
    '.fsts-rv-carousel::-webkit-scrollbar,.fsts-rv-slider::-webkit-scrollbar{height:4px}',
    '.fsts-rv-carousel::-webkit-scrollbar-thumb,.fsts-rv-slider::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px}',
    '.fsts-rv-carousel .fsts-rv-card,.fsts-rv-slider .fsts-rv-card{flex:0 0 300px;scroll-snap-align:start}',
    '.fsts-rv-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px}',
    '.fsts-rv-stars{display:flex;gap:2px;line-height:1}',
    '.fsts-rv-star{color:#fbbf24;font-size:14px}',
    '.fsts-rv-star.empty{color:#e2e8f0}',
    '.fsts-rv-name{font-weight:600;font-size:14px;color:#0f172a}',
    '.fsts-rv-text{font-size:13px;color:#475569;line-height:1.5;margin:0}',
    '.fsts-rv-date{font-size:11px;color:#94a3b8}',
    '.fsts-rv-badge{display:inline-block;font-size:10px;font-weight:600;padding:2px 7px;border-radius:99px;text-transform:capitalize}',
    '.fsts-rv-badge.google{background:#fef2f2;color:#dc2626}',
    '.fsts-rv-badge.facebook{background:#eff6ff;color:#2563eb}',
    '.fsts-rv-badge.yelp{background:#fff7ed;color:#c2410c}',
    '.fsts-rv-header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}',
  ].join('');

  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s += '<span class="fsts-rv-star' + (i > n ? ' empty' : '') + '">&#9733;</span>';
    }
    return '<div class="fsts-rv-stars">' + s + '</div>';
  }

  function card(r) {
    var badge = SHOW_BADGE
      ? '<span class="fsts-rv-badge ' + r.provider + '">' + r.provider + '</span>'
      : '';
    return '<div class="fsts-rv-card">' +
      '<div class="fsts-rv-header">' +
        '<span class="fsts-rv-name">' + esc(r.reviewerName) + '</span>' + badge +
      '</div>' +
      stars(r.rating) +
      (r.text ? '<p class="fsts-rv-text">' + esc(r.text) + '</p>' : '') +
      '<span class="fsts-rv-date">' + new Date(r.reviewDate).toLocaleDateString() + '</span>' +
    '</div>';
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  fetch(ENDPOINT)
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var reviews = (data.reviews || [])
        .filter(function(r){ return r.rating >= MIN_RATING; })
        .filter(function(r){ return !FEATURED_ONLY || r.pinned; })
        .filter(function(r){ return !CATEGORY || r.category === CATEGORY; })
        .slice(0, MAX_COUNT);
      var el = document.getElementById('fsts-reviews-widget');
      if (!el || !reviews.length) return;
      el.innerHTML = '<div class="fsts-rv-' + LAYOUT + '">' +
        reviews.map(card).join('') +
      '</div>';
    })
    .catch(function(){});
}();
<\/script>`;
}
