/* Shared shell behaviour (same as Signals' app.js): site bar drawer, one open menu at a time, cookie consent, toast. */
(function(){
  // ---------- external links open in a new tab (fintrens.com and its /signals/ are one site) ----------
  (function(){const here=location.hostname.replace(/^www\./,"");document.querySelectorAll('a[href^="http"]').forEach(a=>{let h;try{h=new URL(a.href).hostname.replace(/^www\./,"")}catch(e){return}if(h===here)return;a.target="_blank";const rel=(a.getAttribute("rel")||"").split(/\s+/).filter(Boolean);for(const r of ["noopener","noreferrer"])if(!rel.includes(r))rel.push(r);a.setAttribute("rel",rel.join(" "))})})();

  const $=id=>document.getElementById(id);
  const toast=m=>{const t=$("toast");if(!t)return;t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)};
  (function(){const b=$("sn-burger"),m=$("sn-m");if(!b||!m)return;b.addEventListener("click",()=>{const o=m.classList.toggle("open");b.setAttribute("aria-expanded",o);document.body.style.overflow=o?"hidden":""});
    document.addEventListener("click",e=>{if(!e.target.closest(".sn-nav"))document.querySelectorAll(".sn-nav details[open]").forEach(d=>d.removeAttribute("open"))});
    document.querySelectorAll(".sn-nav details").forEach(d=>d.addEventListener("toggle",()=>{if(d.open)document.querySelectorAll(".sn-nav details[open]").forEach(o=>{if(o!==d)o.removeAttribute("open")})}))})();
  (function(){const c=$("consent");if(!c)return;let v=null;try{v=localStorage.getItem("fx_consent")}catch(e){}if(v){c.hidden=true}else{const show=()=>setTimeout(()=>{c.hidden=false},400);document.readyState==="complete"?show():window.addEventListener("load",show)}
    const set=x=>{try{localStorage.setItem("fx_consent",x)}catch(e){}c.hidden=true;document.dispatchEvent(new CustomEvent("fx:consent",{detail:x}));toast(x==="all"?"Cookies accepted.":"Essential cookies only.")};
    $("c-accept").addEventListener("click",()=>set("all"));$("c-reject").addEventListener("click",()=>set("essential"))})();
})();
