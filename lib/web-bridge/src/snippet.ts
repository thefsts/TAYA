/**
 * Bridge snippet v2 — the self-contained embed any external site pastes.
 *
 * VANILLA JS: no imports, no bundler, no framework. The generated string
 * must run standalone in any browser. It:
 *   1. fetches PUBLISHED values from /api/bridge/content and applies them
 *      to matching [data-taya-edit] elements (textContent/src/href),
 *   2. dispatches taya:element-click on clicks (bubbling) and reports
 *      them to /api/bridge/click (sendBeacon where available),
 *   3. when a token is supplied (draft preview mode), fetches
 *      /api/bridge/draft and overlays draft values, dispatching
 *      taya:preview-applied,
 *   4. v2: renders PUBLISHED zone blocks (§6 safe insertion zones) —
 *      server-sanitized HTML appended into [data-taya-zone] containers
 *      (or the honest fallback container when a zone has no marker),
 *   5. v2: applies PUBLISHED structural ops — hides removed repeatable
 *      items (display:none) and reorders remaining ones (DOM move),
 *      (in preview mode 4+5 run ONCE, in the token-gated draft pass,
 *      which serves the complete draft state — the public pass applies
 *      values only so unchanged blocks never render twice),
 *   6. dispatches taya:bridge-ready when values have been applied, and
 *      taya:blocks-applied / taya:structural-applied for the v2 passes.
 *
 * DRAFT ISOLATION: the public /content payload carries published blocks
 * and structural only — draft blocks/structural reach the DOM solely
 * through the token-gated /draft preview fetch.
 *
 * Determinism: the output is a pure function of (convexHttpUrl, slug) —
 * required by web-bridge-contract.test.ts (no customer-specific values,
 * no random IDs, no timestamps).
 */

import {
  BRIDGE_ATTR_KEY,
  BRIDGE_ATTR_TYPE,
  BRIDGE_ATTR_ZONE,
  BRIDGE_EVENT_BLOCKS_APPLIED,
  BRIDGE_EVENT_CLICK,
  BRIDGE_EVENT_PREVIEW_APPLIED,
  BRIDGE_EVENT_READY,
  BRIDGE_EVENT_STRUCTURAL_APPLIED,
  BRIDGE_PARAM_SLUG,
  BRIDGE_PARAM_TOKEN,
  BRIDGE_PATH_CLICK,
  BRIDGE_PATH_CONTENT,
  BRIDGE_PATH_DRAFT,
} from "./contract";

export interface SnippetOptions {
  /** e.g. "https://uncommon-cobra-336.convex.site" */
  convexHttpUrl: string;
  /** The site's public slug. */
  slug: string;
}

/**
 * Generate the standard embed. Deterministic in (convexHttpUrl, slug).
 */
export function generateBridgeSnippet(options: SnippetOptions): string {
  const base = options.convexHttpUrl.replace(/\/+$/, "");
  const slug = options.slug;

  // Payload is embedded as a JSON blob (safe escaping: only " and \
  // need escaping inside a JS string literal for these values).
  const config = JSON.stringify({ base, slug });

  return `<!-- TAYA Web Bridge v2 -->
<script>
!function(){
  var CFG=${config};
  var VER=2;
  function all(){return document.querySelectorAll('[${BRIDGE_ATTR_KEY}]');}
  function apply(el,val){
    if(val==null)return;
    var t=el.getAttribute('${BRIDGE_ATTR_TYPE}');
    if(t==='image'){el.setAttribute('src',val);return;}
    if(t==='url'||t==='link'||t==='button'){el.setAttribute('href',val);return;}
    el.textContent=val;
  }
  function dispatch(name,detail){
    try{document.dispatchEvent(new CustomEvent(name,{detail:detail,bubbles:true,composed:true}));}catch(e){}
  }
  function report(key,type,path){
    try{
      var body=JSON.stringify({${BRIDGE_PARAM_SLUG}:CFG.slug,key:key,type:type||null,path:path||null});
      if(navigator.sendBeacon){
        navigator.sendBeacon(CFG.base+'${BRIDGE_PATH_CLICK}',new Blob([body],{type:'application/json'}));
      }else{
        fetch(CFG.base+'${BRIDGE_PATH_CLICK}',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true});
      }
    }catch(e){}
  }
  document.addEventListener('click',function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest('[${BRIDGE_ATTR_KEY}]'):null;
    if(!el)return;
    var key=el.getAttribute('${BRIDGE_ATTR_KEY}');
    dispatch('${BRIDGE_EVENT_CLICK}',{key:key,type:el.getAttribute('${BRIDGE_ATTR_TYPE}'),label:el.getAttribute('data-taya-label'),page:el.getAttribute('data-taya-page')});
    report(key,el.getAttribute('${BRIDGE_ATTR_TYPE}'),el.getAttribute('data-taya-page'));
  },true);

  function run(published){
    var els=all();
    var applied=0;
    for(var i=0;i<els.length;i++){
      var key=els[i].getAttribute('${BRIDGE_ATTR_KEY}');
      if(published[key]!=null){apply(els[i],published[key]);applied++;}
    }
    return applied;
  }

  // ── v2: page resolution (payload blocks are keyed by route path) ────
  function pageFor(data){
    // The payload's pages[] carry the CRAWLED route paths ("/", "/about").
    // Resolve location.pathname against them with the same normalization
    // the crawl applies (normalizeRoute): directory-index files collapse
    // to their directory, common extensions drop, trailing slashes strip.
    // No match → null → no blocks/structural (honest — never guess a page).
    try{
      var p=location.pathname||'/';
      p=p.replace(/\\/(index|default)\\.(html?|php|aspx?)$/i,'/');
      p=p.replace(/\\.(html?|php|aspx?|jsp)$/i,'');
      p='/'+p.replace(/^\\/+|\\/+$/g,'');
      if(p==='')p='/';
      var pages=data.pages||[];
      for(var i=0;i<pages.length;i++){
        if(pages[i]&&pages[i].path===p)return p;
      }
    }catch(e){}
    return null;
  }

  function zoneSelector(zone){return '[${BRIDGE_ATTR_ZONE}="'+zone+'"]';}

  // ── v2: published zone blocks → safe containers ─────────────────────
  // Server-rendered, sanitized HTML (editorBlocks) — the snippet only
  // APPENDS; it never synthesizes its own markup and never removes
  // existing site content. Zones without a [data-taya-zone] marker use
  // the honest fallback: the page's <main> (or body) as the container.
  function blocksFor(page){
    var list=page?page.length?page:[page]:[];
    var applied=0;
    for(var i=0;i<list.length;i++){
      var z=list[i];
      if(!z||!z.zone||typeof z.html!=='string'||!z.html)continue;
      var container=document.querySelector(zoneSelector(z.zone));
      if(!container){
        container=document.querySelector('main')||document.body;
      }
      if(!container)continue;
      try{
        // The server already sanitized this HTML (editorBlocks esc()).
        container.insertAdjacentHTML('beforeend',z.html);
        applied++;
      }catch(e){}
    }
    return applied;
  }

  // ── v2: published structural ops (hide removed, reorder) ────────────
  // Item ids are §5 key prefixes (e.g. "services.items[2]") stamped on
  // annotated elements by the crawl. The bridge hides every element of
  // a hidden item, and reorders the FIRST anchor element of each ordered
  // item within its shared parent (same discipline as the editor frame).
  function itemIdOf(el){
    var m=/^(.+items\\[[0-9]+\\])/.exec(el.getAttribute('${BRIDGE_ATTR_KEY}')||'');
    return m?m[1]:null;
  }
  function itemBlocks(){
    var map={};
    var els=all();
    for(var i=0;i<els.length;i++){
      var id=itemIdOf(els[i]);
      if(id===null)continue;
      (map[id]=map[id]||[]).push(els[i]);
    }
    return map;
  }
  function structuralFor(page){
    if(!page)return {hidden:0,reordered:0};
    var hidden=0,reordered=0;
    var blocks=itemBlocks();
    if(page.hiddenItems&&page.hiddenItems.length){
      for(var i=0;i<page.hiddenItems.length;i++){
        var els=blocks[page.hiddenItems[i]];
        if(els){for(var j=0;j<els.length;j++){els[j].style.display='none';hidden++;}}
      }
    }
    if(page.itemOrder&&page.itemOrder.length>1){
      try{
        var anchors=[];
        for(var k=0;k<page.itemOrder.length;k++){
          var ae=blocks[page.itemOrder[k]];
          if(ae&&ae.length)anchors.push(ae[0]);
        }
        if(anchors.length>1){
          var parent=anchors[0].parentElement;
          if(parent){
            for(var a=0;a<anchors.length;a++){
              parent.insertBefore(anchors[a],parent.children[Math.min(a,parent.children.length)]||null);
            }
            reordered=anchors.length;
          }
        }
      }catch(e){}
    }
    return {hidden:hidden,reordered:reordered};
  }

  fetch(CFG.base+'${BRIDGE_PATH_CONTENT}?${BRIDGE_PARAM_SLUG}='+encodeURIComponent(CFG.slug))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(data){
      if(!data)return;
      run(data.values||{});
      // v2 passes — published only, best-effort, never throwing. In
      // preview mode they are DEFERRED to the token-gated draft pass: it
      // serves the complete draft state (draft blocks + draft structural),
      // and pre-applying published blocks here would double-render every
      // unchanged block. Values still apply (graceful fallback if the
      // draft fetch fails).
      if(!PREVIEW){
        try{
          var pk=pageFor(data);
          var blocksApplied=blocksFor(pk!==null&&data.blocks?data.blocks[pk]:null);
          if(blocksApplied>0){dispatch('${BRIDGE_EVENT_BLOCKS_APPLIED}',{count:blocksApplied});}
          var st=structuralFor(pk!==null&&data.structural?data.structural[pk]:null);
          if(st.hidden>0||st.reordered>0){dispatch('${BRIDGE_EVENT_STRUCTURAL_APPLIED}',st);}
        }catch(e){}
      }
      dispatch('${BRIDGE_EVENT_READY}',{bridgeVersion:VER,count:Object.keys(data.values||{}).length});
    })
    .catch(function(){});

  // Draft preview mode — opt-in via URL: ?taya_preview=<token>
  // PREVIEW is set synchronously (regex on location.search) before any
  // fetch .then callback can run, so the content pass below can rely on it.
  var PREVIEW=false;
  try{
    var m=location.search.match(/[?&]taya_preview=([a-f0-9]{12,64})/i);
    if(m){PREVIEW=true;
      fetch(CFG.base+'${BRIDGE_PATH_DRAFT}?${BRIDGE_PARAM_SLUG}='+encodeURIComponent(CFG.slug)+'&${BRIDGE_PARAM_TOKEN}='+m[1])
        .then(function(r){return r.ok?r.json():null;})
        .then(function(data){
          if(!data)return;
          var merged={};
          var vals=data.values||{},drfts=data.drafts||{};
          for(var k in vals)merged[k]=vals[k];
          for(var d in drfts)merged[d]=drfts[d];
          run(merged);
          try{
            var pk2=pageFor(data);
            var blocksApplied2=blocksFor(pk2!==null&&data.blocks?data.blocks[pk2]:null);
            if(blocksApplied2>0){dispatch('${BRIDGE_EVENT_BLOCKS_APPLIED}',{count:blocksApplied2,draft:true});}
            var st2=structuralFor(pk2!==null&&data.structural?data.structural[pk2]:null);
            if(st2.hidden>0||st2.reordered>0){dispatch('${BRIDGE_EVENT_STRUCTURAL_APPLIED}',Object.assign({draft:true},st2));}
          }catch(e){}
          dispatch('${BRIDGE_EVENT_PREVIEW_APPLIED}',{bridgeVersion:VER,draftCount:Object.keys(drfts||{}).length});
        })
        .catch(function(){});
    }
  }catch(e){}
}();
</script>`;
}

/**
 * Draft preview URL for a site owner: the site's own URL plus the
 * taya_preview token parameter the snippet recognizes.
 */
export function buildPreviewUrl(siteUrl: string, token: string): string {
  const joiner = siteUrl.includes("?") ? "&" : "?";
  return `${siteUrl}${joiner}taya_preview=${token}`;
}
