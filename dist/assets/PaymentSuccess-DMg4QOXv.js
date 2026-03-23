import{r as y,j as h}from"./index-Cwj7LXov.js";async function w(e){const a=await e.text();if(!a)return null;try{return JSON.parse(a)}catch{return{raw:a}}}function x(e){const a=e.quantity||1,i=e.unitPrice??e.total??0;return Number(i)*a}function b(e){const i=(Array.isArray(e==null?void 0:e.cart)?e.cart:[]).reduce((u,o)=>u+x(o),0),n=Number(e==null?void 0:e.subtotal)>0?Number(e.subtotal):i,s=Number(e==null?void 0:e.shippingCost),d=Number(e==null?void 0:e.total)>0?Number(e.total):n+(Number.isFinite(s)&&s>0?s:0);return{...e,subtotal:n,total:d}}function O(){const[e,a]=y.useState("verifying"),[i,n]=y.useState("Verifying payment...");y.useEffect(()=>{(async()=>{var o,g;try{const p=new URLSearchParams(window.location.search).get("tap_id");if(!p)throw new Error("Missing payment ID");n("Verifying payment with Tap...");const m=await fetch(`/api/tap/verify?tap_id=${p}`),t=await w(m);if(!m.ok||!t||t.status!=="CAPTURED"&&t.status!=="AUTHORIZED")throw console.error("Payment verification failed",t),new Error("Payment verification failed: "+(t&&(t.status||t.error||t.detail)||`HTTP ${m.status}`));n("Creating your order...");const v=localStorage.getItem("ezOrderDraft");if(!v)throw new Error("Order draft not found");const r=b(JSON.parse(v));r.paymentDetails=t,r.paymentMethod="tap",r.paymentStatus="Paid",r.paymentReference=((o=t.reference)==null?void 0:o.payment)||((g=t.reference)==null?void 0:g.transaction)||t.id||p,localStorage.setItem("ezOrderDraft",JSON.stringify(r));const f=await fetch("/api/createOrder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!f.ok){const c=await w(f);throw new Error(c&&(c.error||c.detail||c.message)||"Order creation failed")}a("success"),n("Payment confirmed and order created!"),localStorage.removeItem("ezCart"),localStorage.removeItem("ezOrderDraft"),setTimeout(()=>{window.location.href="/"},5e3)}catch(l){console.error(l),a("failed"),n(l.message||"Something went wrong")}})()},[]);const s=`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title">Pending Confirmation</div>
        <div style="margin:20px 0;">
          <img src="/assets/loading.gif" alt="Loading" style="width:100px; height:auto; display:inline-block;" />
        </div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${i}</div>
      </div>
    </div>
  `,d=e==="success"?`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" data-i18n="confirmationTitle">Order Confirmed</div>
        <div style="font-size:3rem; margin:20px 0;">✅</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${i}</div>
        <div style="font-size:0.9rem; margin-top:10px; opacity:0.7;">Redirecting home...</div>
      </div>
    </div>
  `:e==="failed"?`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" style="color:#ff4444">Order Failed</div>
        <div style="font-size:3rem; margin:20px 0;">❌</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${i}</div>
        <button onclick="window.location.href='/checkout'" class="place-order-btn" style="margin-top:20px">Try Again</button>
      </div>
    </div>
  `:s;return h.jsx("div",{dangerouslySetInnerHTML:{__html:d}})}export{O as default};
