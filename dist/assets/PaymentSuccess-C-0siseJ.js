import{r as n,j as y}from"./index-uZjsNsd9.js";function u(){const[s,o]=n.useState("verifying"),[a,t]=n.useState("Verifying payment...");n.useEffect(()=>{(async()=>{try{const d=new URLSearchParams(window.location.search).get("tap_id");if(!d)throw new Error("Missing payment ID");t("Verifying payment with Tap...");const c=await fetch(`/api/tap/verify?tap_id=${d}`),e=await c.json();if(!c.ok||e.status!=="CAPTURED"&&e.status!=="AUTHORIZED")throw console.error("Payment verification failed",e),new Error("Payment verification failed: "+(e.status||"Unknown"));t("Creating your order...");const l=localStorage.getItem("ezOrderDraft");if(!l)throw new Error("Order draft not found");const r=JSON.parse(l);r.paymentDetails=e,r.paymentMethod="online";const f=await fetch("/api/createOrder",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!f.ok){const m=await f.json();throw new Error(m.error||"Order creation failed")}o("success"),t("Payment confirmed and order created!"),localStorage.removeItem("ezCart"),localStorage.removeItem("ezOrderDraft"),setTimeout(()=>{window.location.href="/"},5e3)}catch(i){console.error(i),o("failed"),t(i.message||"Something went wrong")}})()},[]);const p=`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title">Pending Confirmation</div>
        <div style="font-size:3rem; margin:20px 0;">⏳</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${a}</div>
      </div>
    </div>
  `,v=s==="success"?`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" data-i18n="confirmationTitle">Order Confirmed</div>
        <div style="font-size:3rem; margin:20px 0;">✅</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${a}</div>
        <div style="font-size:0.9rem; margin-top:10px; opacity:0.7;">Redirecting home...</div>
      </div>
    </div>
  `:s==="failed"?`
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" style="color:#ff4444">Order Failed</div>
        <div style="font-size:3rem; margin:20px 0;">❌</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${a}</div>
        <button onclick="window.location.href='/checkout'" class="place-order-btn" style="margin-top:20px">Try Again</button>
      </div>
    </div>
  `:p;return y.jsx("div",{dangerouslySetInnerHTML:{__html:v}})}export{u as default};
