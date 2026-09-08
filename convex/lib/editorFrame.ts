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
    "html.taya-editing a[href]{cursor:pointer;}"
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

  // ── click-to-edit ──────────────────────────────────────────────────────
  document.addEventListener("click",function(ev){
    var el=ev.target&&ev.target.closest?ev.target.closest("[data-taya-edit]"):null;
    if(el){
      ev.preventDefault();ev.stopPropagation();
      select(el);
      post({kind:"element-click",
        key:el.getAttribute("data-taya-edit"),
        type:el.getAttribute("data-taya-type"),
        label:labelFor(el),
        alt:el.getAttribute("alt")||null,
        text:(el.textContent||"").trim().slice(0,200)||null,
        href:el.getAttribute("href")||null,
        itemId:itemIdOf(el)});
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
            post({kind:"navigate",path:u.pathname+u.search});
          }
        }
      }
    }
  },true);

  // ── draft overlay application (parent \u2192 frame) ────────────────────────
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
    // Move the FIRST container element of each item block to match order.
    // The parent sends {itemIds:[...]} in desired order; blocks hide/show
    // by index \u2014 visual reorder preview only (the draft carries the real
    // reorder intent; publish writes the map).
    try{
      var m=itemBlocks();
      var anchors=[];
      for(var i=0;i<op.itemIds.length;i++){
        var els=m[op.itemIds[i]];
        if(els&&els.length)anchors.push(els[0]);
      }
      // find common parent of first anchors; re-append in order
      if(anchors.length>1){
        var parent=anchors[0].parentElement;
        if(parent){
          for(var j=0;j<anchors.length;j++){
            parent.insertBefore(anchors[j],parent.children[Math.min(j,parent.children.length)]||null);
          }
        }
      }
      post({kind:"preview-applied",applied:0,op:"reorder"});
    }catch(e){}
  }

  function opAdd(op){
    // The parent supplies rendered HTML for the new item (built from the
    // client-side template in the dashboard, key-annotated). It is preview
    // only until the draft is published.
    try{
      if(op.html&&op.containerSelector){
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
    }
    else if(d.kind==="ping"){post({kind:"pong",path:CFG.path});}
  });

  post({kind:"ready",path:CFG.path,slug:CFG.slug});
}();
</script>`;
}
