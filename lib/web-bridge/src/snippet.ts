/**
 * Bridge snippet — the self-contained embed any external site pastes.
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
 *   4. dispatches taya:bridge-ready when values have been applied.
 *
 * Determinism: the output is a pure function of (convexHttpUrl, slug) —
 * required by web-bridge-contract.test.ts (no customer-specific values,
 * no random IDs, no timestamps).
 */

import {
  BRIDGE_ATTR_KEY,
  BRIDGE_ATTR_TYPE,
  BRIDGE_EVENT_CLICK,
  BRIDGE_EVENT_PREVIEW_APPLIED,
  BRIDGE_EVENT_READY,
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

  return `<!-- TAYA Web Bridge v1 -->
<script>
!function(){
  var CFG=${config};
  var VER=1;
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

  fetch(CFG.base+'${BRIDGE_PATH_CONTENT}?${BRIDGE_PARAM_SLUG}='+encodeURIComponent(CFG.slug))
    .then(function(r){return r.ok?r.json():null;})
    .then(function(data){
      if(!data)return;
      run(data.values||{});
      dispatch('${BRIDGE_EVENT_READY}',{bridgeVersion:VER,count:Object.keys(data.values||{}).length});
    })
    .catch(function(){});

  // Draft preview mode — opt-in via URL: ?taya_preview=<token>
  try{
    var m=location.search.match(/[?&]taya_preview=([a-f0-9]{12,64})/i);
    if(m){
      fetch(CFG.base+'${BRIDGE_PATH_DRAFT}?${BRIDGE_PARAM_SLUG}='+encodeURIComponent(CFG.slug)+'&${BRIDGE_PARAM_TOKEN}='+m[1])
        .then(function(r){return r.ok?r.json():null;})
        .then(function(data){
          if(!data)return;
          var merged={};
          var vals=data.values||{},drfts=data.drafts||{};
          for(var k in vals)merged[k]=vals[k];
          for(var d in drfts)merged[d]=drfts[d];
          run(merged);
          dispatch('${BRIDGE_EVENT_PREVIEW_APPLIED}',{bridgeVersion:VER,draftCount:Object.keys(drfts).length});
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
