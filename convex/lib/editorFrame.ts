/**
 * PHASE 3 \u2014 Editor frame document transform (spec \u00a79\u2013\u00a710, \u00a726).
 *
 * PURE LIBRARY \u2014 no Convex ctx, no network, no customer logic.
 *
 * /api/editor/frame fetches the customer's REAL page server-side and serves
 * it from the Convex origin so the editor can click-to-edit it. Because
 * TAYA is proxying a real webpage into an authenticated editor, the frame
 * is deliberately EDITOR-SAFE:
 *
 *   - every site <script> is stripped (no arbitrary third-party JS runs
 *     inside the TAYA editor \u2014 analytics, trackers, site bundles, nothing);
 *   - the page is served from the CONVEX origin with a <base> pointing at
 *     the real site so stylesheets/images/fonts still resolve for an
 *     accurate visual preview;
 *   - TAYA's own editor bootstrap (vanilla, injected below) is the ONLY
 *     script in the document;
 *   - the transform never widens into an unrestricted URL fetcher \u2014 the
 *     caller (editor.ts _frameSite) validates the path against the site's
 *     OWN discovered routes before any fetch happens.
 *
 * DRAFTS NEVER PASS THROUGH HERE. The frame fetch renders the page exactly
 * as an anonymous visitor sees it (discovered/published values). Draft
 * values flow parent \u2192 iframe via postMessage only \u2014 preview isolation
 * is structural (\u00a716): no draft value ever enters an HTTP response.
 */

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Script stripping
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/**
 * Remove EVERY site <script> element (classic, src'd, module, async,
 * defer, type=application/ld+json scripts too \u2014 none of them execute and
 * ld+json is data we never need in the editor preview). Also removes
 * <noscript> wrappers (their fallback content would double-render) and
 * intrinsic-event attributes (onclick= \u2026) so nothing site-side can run.
 *
 * The editor bootstrap is injected AFTER this pass (buildFrameDocument),
 * so it is never stripped.
 */
export function stripExecutableScripts(html: string): string {
  return html
    // paired script blocks (incl. empty and multiline)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    // self-closing / src-only script tags
    .replace(/<script\b[^>]*\/>/gi, "")
    // noscript fallback content (keep the tag presence harmless, drop body)
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, "")
    // intrinsic event handlers on any tag
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // iframe srcdoc / embeds of live third-party frames
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<iframe\b[^>]*\/>/gi, "");
}

/**
 * Neutralize top-level navigation the surviving markup could trigger:
 * meta refresh, target=_blank/_top on any surviving anchor, and form
 * submissions. (The bootstrap also intercepts link clicks while editing.)
 */
export function neutralizeNavigation(html: string): string {
  return html
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
    .replace(/\starget\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Frame document assembly
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export interface FrameDocumentOptions {
  /** Site origin the fetched page came from, e.g. "https://example.com". */
  origin: string;
  /** \u00a75 route path of the fetched page ("/", "/services", \u2026). */
  path: string;
  /** Site slug (postMessage routing back to the dashboard parent). */
  slug: string;
  /** Dashboard origin allowed to drive this frame (postMessage sender). */
  dashboardOrigin: string;
}

/**
 * Build the editor-safe frame document:
 *   stripped + annotated HTML + <base> + CSP meta + editor bootstrap.
 *
 * CSP (frame-ancestors is enforced via response header by the route; the
 * meta CSP belt-and-braces the same rules inside the document):
 *   - script-src 'none' except the bootstrap (which is a data-free inline
 *     the route serves; see route \u2014 it appends its own nonce) \u2014 kept
 *     permissive-inline here because the route trusts only its own output;
 *   - no object/embed, no forms submission off-origin.
 */
export function buildFrameDocument(
  html: string,
  opts: FrameDocumentOptions,
): string {
  const safe = neutralizeNavigation(stripExecutableScripts(html));

  const headExtras = `<base href="${escapeAttr(opts.origin)}/">
<meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src 'unsafe-inline'; object-src 'none'; form-action 'none'; frame-src 'none'">
<meta name="referrer" content="no-referrer">`;

  const bootstrap = buildEditorBootstrap(opts);

  let out = safe;
  // Head injection: after <head> if present, else before the first <body.
  if (/<head\b[^>]*>/i.test(out)) {
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}\n${headExtras}`);
  } else if (/<body\b[^>]*>/i.test(out)) {
    out = out.replace(/<body\b[^>]*>/i, (m) => `${m}\n${headExtras}`);
  } else {
    out = `${headExtras}\n${out}`;
  }

  // Bootstrap injection: before </body>, else at the end.
  if (/<\/body\s*>/i.test(out)) {
    out = out.replace(/<\/body\s*>/i, () => `${bootstrap}\n</body>`);
  } else {
    out = `${out}\n${bootstrap}`;
  }
  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ─────────────────────────────────────────────────────────────────────────────
// Editor bootstrap — the ONLY script in the frame document (vanilla JS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The bootstrap the frame runs. Responsibilities (\u00a79\u2013\u00a711):
 *   1. mark every annotated element with a hover outline + pointer;
 *   2. on click \u2192 postMessage {source:"taya-editor", kind:"element-click",
 *      key, type, label, alt, text, href, itemId} to the dashboard parent
 *      (origin-checked both ways);
 *   3. intercept same-site navigation links \u2192 ask the parent to navigate
 *      the frame to that discovered route (page navigator parity);
 *   4. apply parent-posted draft overlays (text\u2192textContent, image\u2192src,
 *      button/link\u2192label+href via the same grammar the bridge uses) and
 *      post preview-applied;
 *   5. repeatable preview operations (add/remove/reorder items) applied
 *      in-frame only where the parent sends them.
 *
 * It NEVER fetches drafts itself (preview privacy is structural: drafts
 * arrive by postMessage from the authenticated parent only) and never
 * exposes keys in any rendered UI \u2014 keys travel parent\u2194frame only.
 */
export function buildEditorBootstrap(opts: FrameDocumentOptions): string {
  const cfg = {
    slug: opts.slug,
    path: opts.path,
    origin: opts.origin,
    dashboardOrigin: opts.dashboardOrigin,
  };
  const config = JSON.stringify(cfg).replace(/<\//g, "<\\/");

  return `<script id="taya-editor-bootstrap">
!function(){
  "use strict";
  var CFG=${config};
  function post(msg){
    try{
      if(window.parent!==window){
        window.parent.postMessage(Object.assign({source:"taya-editor"},msg),"*");
      }
    }catch(e){}
  }

  function labelFor(el){
    var t=(el.textContent||"").trim();
    if(t.length>0)return t.slice(0,120);
    var a=el.getAttribute("alt")||el.getAttribute("title")||el.getAttribute("aria-label");
    return a?a.slice(0,120):"";
  }

  var CSS=document.createElement("style");
  CSS.textContent=[
    "[data-taya-edit]{outline:1px dashed rgba(37,99,235,.55);outline-offset:2px;cursor:pointer;}",
    "[data-taya-edit]:hover{outline:2px solid rgba(37,99,235,.9);outline-offset:2px;}",
    "[data-taya-edit].taya-selected{outline:2px solid #2563eb;outline-offset:2px;}",
    "html.taya-editing a[href]{cursor:pointer;}",
    "[data-taya-edit].taya-selected{outline:3px solid #2563eb;outline-offset:2px;box-shadow:0 0 0 6px rgba(37,99,235,.18);}",
    "[data-taya-edit]:focus-visible{outline:3px solid #1d4ed8;outline-offset:2px;}",
    ".taya-block[data-taya-block-id]{outline:1px dashed rgba(37,99,235,.45);outline-offset:4px;}",
    ".taya-block[data-taya-block-id]:hover{outline:2px solid rgba(37,99,235,.8);outline-offset:4px;}",
    ".taya-block[data-taya-block-id].taya-selected{outline:3px solid #2563eb;outline-offset:4px;box-shadow:0 0 0 6px rgba(37,99,235,.18);}"
  ].join("\\n");
  try{
    (document.head||document.documentElement).appendChild(CSS);
    document.documentElement.classList.add("taya-editing");
  }catch(e){}

  var selected=null;
  function select(el){
    if(selected)selected.classList.remove("taya-selected");
    selected=el;el.classList.add("taya-selected");
  }
  function deselect(){
    if(selected)selected.classList.remove("taya-selected");
    selected=null;
  }
  // Content kind in client language (no zone ids, no keys, no internals).
  function kindOf(el){
    var type=el.getAttribute("data-taya-type");
    var tag=el.tagName;
    if(type==="image"||tag==="IMG")return "image";
    if(tag==="H1"||tag==="H2"||tag==="H3"||tag==="H4"||tag==="H5"||tag==="H6")return "heading";
    var key=el.getAttribute("data-taya-edit")||"";
    if(tag==="A"||type==="url"||type==="link"||type==="button"||key.indexOf("button")>-1)return "button";
    if(tag==="A")return "link";
    if(tag==="P")return "paragraph";
    if(type==="list_item"||key.indexOf("items[")>-1)return "list_item";
    return "text";
  }

  // ── click-to-edit ──────────────────────────────────────────────────────
  document.addEventListener("click",function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest("[data-taya-edit]"):null;
    if(el){
      ev.preventDefault();ev.stopPropagation();
      select(el);
      post({kind:"element-click",
        key:el.getAttribute("data-taya-edit"),
        type:el.getAttribute("data-taya-type"),
        contentKind:kindOf(el),
        label:labelFor(el),
        alt:el.getAttribute("alt")||null,
        text:(el.textContent||"").trim().slice(0,200)||null,
        href:el.getAttribute("href")||null,
        itemId:itemIdOf(el)});
      return;
    }
    // Added content blocks carry a stable id; report the block so the parent
    // can open its edit form.
    var bl=ev.target&&ev.target.closest?ev.target.closest("[data-taya-block-id]"):null;
    if(bl){
      ev.preventDefault();ev.stopPropagation();
      select(bl);
      var z=bl.closest("[data-taya-zone]");
      post({kind:"block-click",
        blockId:bl.getAttribute("data-taya-block-id"),
        zone:z?z.getAttribute("data-taya-zone"):null,
        label:labelFor(bl)});
      return;
    }
    // Intercept same-site nav links while editing \u2014 parent navigates.
    var a=ev.target&&ev.target.closest?ev.target.closest("a[href]"):null;
    if(a){
      var href=a.getAttribute("href")||"";
      if(/^(https?:)?\\/\\//.test(href)||href.startsWith("/")&&!href.startsWith("//")){
        ev.preventDefault();ev.stopPropagation();
        var abs=null;
        try{abs=new URL(href,CFG.origin).href;}catch(e){}
        if(abs){
          var u=new URL(abs);
          if(u.origin===CFG.origin){
            ev.preventDefault();ev.stopPropagation();
            post({kind:"navigate",path:u.pathname+u.search});
            return;
          }
          // Off-site link while editing: never navigate silently.
          ev.preventDefault();ev.stopPropagation();
          post({kind:"locked-click",label:labelFor(a),external:true});
          return;
        }
      }
    }
    // Anything else (locked layout, decorative area): say so, never silent.
    ev.preventDefault();
    post({kind:"locked-click",label:labelFor(ev.target),external:false});
  },true);

  // ── draft overlay application (parent \u2192 frame) ────────────────────────
  // Keyboard selection (a11y): tabbable content, Enter/Space to select,
  // Escape to clear the selection.
  function makeFocusable(){
    var els=document.querySelectorAll("[data-taya-edit],[data-taya-block-id]");
    for(var i=0;i<els.length;i++){
      var el=els[i];
      var n=el.getAttribute("tabindex");
      if(n==null&&el.tabIndex<0)el.setAttribute("tabindex","0");
    }
  }
  document.addEventListener("keydown",function(ev){
    if(ev.key==="Escape"){
      if(selected){deselect();post({kind:"selection-cleared"});}
      return;
    }
    if(ev.key!=="Enter"&&ev.key!==" ")return;
    var t=ev.target;
    if(!t||!t.closest)return;
    var el=t.closest("[data-taya-edit]");
    if(el&&t===el){
      ev.preventDefault();
      select(el);
      post({kind:"element-click",
        key:el.getAttribute("data-taya-edit"),
        type:el.getAttribute("data-taya-type"),
        contentKind:kindOf(el),
        label:labelFor(el),
        alt:el.getAttribute("alt")||null,
        text:(el.textContent||"").trim().slice(0,200)||null,
        href:el.getAttribute("href")||null,
        itemId:itemIdOf(el)});
      return;
    }
    var bl=t.closest("[data-taya-block-id]");
    if(bl&&t===bl){
      ev.preventDefault();
      select(bl);
      var z=bl.closest("[data-taya-zone]");
      post({kind:"block-click",
        blockId:bl.getAttribute("data-taya-block-id"),
        zone:z?z.getAttribute("data-taya-zone"):null,
        label:labelFor(bl)});
    }
  });

  function applyValue(el,val,type){
    if(val==null)return false;
    if(type==="image"||el.tagName==="IMG"){el.setAttribute("src",val);return true;}
    if(type==="url"||type==="link"||type==="button"){el.setAttribute("href",val);return true;}
    el.textContent=val;return true;
  }

  function keyOf(el){return el.getAttribute("data-taya-edit");}

  function applyOverlay(entries){
    // entries: {key:{value,type,href?}} \u2014 one value per annotated key
    var els=document.querySelectorAll("[data-taya-edit]");
    var applied=0;
    for(var i=0;i<els.length;i++){
      var k=keyOf(els[i]);
      var e=entries[k];
      if(!e)continue;
      if(applyValue(els[i],e.value,e.type!==undefined?e.type:els[i].getAttribute("data-taya-type")))applied++;
      if(e.href!==undefined&&els[i].tagName==="A"){els[i].setAttribute("href",e.href);}
    }
    post({kind:"preview-applied",applied:applied});
  }

  // ── repeatable ops (parent \u2192 frame; preview only) ─────────────────────
  function itemIdOf(el){
    // §5 item keys are <section>.items[i].title/.description/.image — the
    // item prefix (…items[i]) IS the block id, derived from the key the
    // annotation engine already stamped (there is no data-taya-item attr).
    var m=/^(.+items\\[[0-9]+\\])/.exec(el.getAttribute("data-taya-edit")||"");
    return m?m[1]:null;
  }

  function itemBlocks(){
    var map={};
    var els=document.querySelectorAll("[data-taya-edit]");
    for(var i=0;i<els.length;i++){
      var id=itemIdOf(els[i]);
      if(id===null)continue;
      (map[id]=map[id]||[]).push(els[i]);
    }
    return map;
  }
  function itemRootOf(els){
    // The item ROOT is the closest ancestor that contains ALL of the
    // item's annotated elements and NO OTHER item's elements: walk up
    // from the first element while the parent still owns the whole item
    // exclusively. That resolves a card (ul>li with h3+p+img) to its li,
    // and a lone link in a nav to the link itself -- never a bare h3
    // dragged into another card, never the shared ul.
    var id=itemIdOf(els[0]);
    var foreign=[];
    var allEls=document.querySelectorAll("[data-taya-edit]");
    for(var q=0;q<allEls.length;q++){
      var fid=itemIdOf(allEls[q]);
      if(fid!==null&&fid!==id)foreign.push(allEls[q]);
    }
    var root=els[0];
    while(root.parentElement){
      var p=root.parentElement;
      if(p===document.body||p===document.documentElement)break;
      var owns=true;
      for(var i=0;i<els.length;i++){if(!p.contains(els[i])){owns=false;break;}}
      if(!owns)break;
      var shared=false;
      for(var f=0;f<foreign.length;f++){if(p.contains(foreign[f])){shared=true;break;}}
      if(shared)break;
      root=p;
    }
    return root;
  }

  function opRemove(op){
    var m=itemBlocks();
    var els=m[op.itemId];
    if(els){for(var i=0;i<els.length;i++){els[i].style.display="none";}}
    post({kind:"preview-applied",applied:0,op:"remove",itemId:op.itemId});
  }

  function opRestore(op){
    var m=itemBlocks();
    var els=m[op.itemId];
    if(els){for(var i=0;i<els.length;i++){els[i].style.display="";}}
    post({kind:"preview-applied",applied:0,op:"restore",itemId:op.itemId});
  }

  function opReorder(op){
    // Reorder the ITEM ROOTS (the card/list-item containing all of an
    // item's annotated elements), never a bare annotated element: the
    // first element's parent is the WRONG home for a multi-element card
    // (it would move a bare h3 into another card). The parent sends
    // {itemIds:[...]} in desired order; this is visual preview only (the
    // draft carries the real reorder intent; publish writes the map).
    try{
      var m=itemBlocks();
      var anchors=[];
      for(var i=0;i<op.itemIds.length;i++){
        var els=m[op.itemIds[i]];
        if(els&&els.length)anchors.push(itemRootOf(els));
      }
      if(anchors.length>1){
        // A page can hold SEVERAL repeatable lists (e.g. services + faq on
        // the same page) and the parent sends ONE itemIds array covering
        // them all. An item may only be reordered INSIDE its own list:
        // group the item roots by the DOM container they live in and
        // reorder each group on its own, preserving the relative order
        // from itemIds. (Using a single shared parent would drag cards
        // across lists.)
        var groups=new Map();
        for(var g=0;g<anchors.length;g++){
          var gp=anchors[g].parentElement;
          if(!gp)continue;
          if(!groups.has(gp))groups.set(gp,[]);
          groups.get(gp).push(anchors[g]);
        }
        groups.forEach(function(list,parent){
          if(list.length>1){
            for(var j=0;j<list.length;j++){
              parent.insertBefore(list[j],parent.children[Math.min(j,parent.children.length)]||null);
            }
          }
        });
      }
      post({kind:"preview-applied",applied:0,op:"reorder"});
    }catch(e){}
  }

  function opZoneRefresh(op){
    // §6 block preview — REBUILD every zone container from the parent's
    // server-rendered payload. The frame document has no [data-taya-zone]
    // markers of its own (the annotator stamps data-taya-edit only), so
    // every marker present was created by a previous preview pass —
    // removing and re-appending is always safe and keeps preview stateless
    // across reloads (the parent re-sends the full draft state on ready).
    // Wrapper tags mirror renderZoneHtml: <section> for the additive zones,
    // <div> for discovered ones — preview matches published rendering.
    try{
      var zones=op.zones||[];
      var host=document.querySelector("main")||document.body;
      if(!host)return;
      for(var i=0;i<zones.length;i++){
        var z=zones[i];
        if(!z||!z.zone||typeof z.html!=="string")continue;
        var stale=host.querySelectorAll('[data-taya-zone="'+z.zone+'"]');
        for(var r=0;r<stale.length;r++){stale[r].parentNode&&stale[r].parentNode.removeChild(stale[r]);}
        if(z.html){
          var tag=(z.zone==="video-section"||z.zone==="cta-stack")?"section":"div";
          host.insertAdjacentHTML("beforeend",'<'+tag+' class="taya-zone taya-zone-'+z.zone+'" data-taya-zone="'+z.zone+'">'+z.html+'</'+tag+'>');
        }
      }
      post({kind:"preview-applied",applied:0,op:"zone-refresh"});
    }catch(e){}
  }

  function opAdd(op){
    // The parent supplies rendered HTML for the new item (built from the
    // client-side template in the dashboard, key-annotated). It is preview
    // only until the draft is published.
    try{
      if(op.html&&op.zone){
        // §6 zone-aware container — append INTO the zone container if a
        // preview pass already created one, else into the page's main
        // content flow (the snippet's honest fallback chain).
        var c=document.querySelector('[data-taya-zone="'+op.zone+'"]')||document.querySelector("main")||document.body;
        if(c){c.insertAdjacentHTML("beforeend",op.html);}
      } else if(op.html&&op.containerSelector){
        var c=document.querySelector(op.containerSelector);
        if(c){c.insertAdjacentHTML("beforeend",op.html);}
      } else if(op.html){
        var all=document.querySelectorAll("[data-taya-edit]");
        var last=null;
        for(var i=0;i<all.length;i++){if(itemIdOf(all[i])!==null)last=all[i];}
        if(last&&last.parentElement){
          last.parentElement.insertAdjacentHTML("beforeend",op.html);
        }
      }
      post({kind:"preview-applied",applied:0,op:"add"});
    }catch(e){}
  }

  // ── parent messages ────────────────────────────────────────────────────
  window.addEventListener("message",function(ev){
    var d=ev.data;
    if(!d||d.source!=="taya-editor-parent")return;
    // Origin check: the dashboard parent only.
    if(CFG.dashboardOrigin&&ev.origin!==CFG.dashboardOrigin)return;
    if(d.kind==="apply-draft"){applyOverlay(d.entries||{});}
    else if(d.kind==="op"){ 
      if(d.op==="remove")opRemove(d);
      else if(d.op==="restore")opRestore(d);
      else if(d.op==="reorder")opReorder(d);
      else if(d.op==="add")opAdd(d);
      else if(d.op==="zone-refresh")opZoneRefresh(d);
    }
    else if(d.kind==="ping"){post({kind:"pong",path:CFG.path});}
  });

  // Scroll preservation: remember where the client was on this page.
  try{
    var sp=sessionStorage.getItem("taya-editor-scroll");
    var so=sp?JSON.parse(sp):null;
    if(so&&so[CFG.path])window.scrollTo(0,so[CFG.path]);
  }catch(e){}
  var lastSave=0;
  window.addEventListener("scroll",function(){
    var now=Date.now();
    if(now-lastSave<250)return;
    lastSave=now;
    try{
      var sp=sessionStorage.getItem("taya-editor-scroll");
      var so=sp?JSON.parse(sp):null;
      if(!so)so={};
      so[CFG.path]=window.scrollY||window.pageYOffset||0;
      sessionStorage.setItem("taya-editor-scroll",JSON.stringify(so));
    }catch(e){}
  },{passive:true});
  makeFocusable();

  post({kind:"ready",path:CFG.path,slug:CFG.slug});
}();
</script>`;
}
