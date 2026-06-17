import{r as n,j as e,d as F,e as M}from"./index-CI1NduUi.js";const G=()=>{const[l,z]=n.useState(localStorage.getItem("ez_lang")||"ar"),j=window.__EZ_I18N__||{},a=r=>j[l]&&j[l][r]||r,[c,S]=n.useState([]),[P,w]=n.useState(!0),[H,L]=n.useState(null),[m,q]=n.useState(""),[u,I]=n.useState("all"),[d,p]=n.useState([]),[i,f]=n.useState({name:"",phone:""}),[D,h]=n.useState(!1),[x,y]=n.useState("cash"),[g,N]=n.useState(!1),b=n.useRef("");n.useEffect(()=>{(async()=>{w(!0);try{const{items:t=[],parts:s=[]}=await F();S([...t,...s])}catch(t){console.error("POS Fetch Error:",t),L("Failed to load products.")}finally{w(!1)}})();const o=t=>{t.key==="Enter"?(T(b.current),b.current=""):t.key.length===1&&(b.current+=t.key,window._barcodeTimeout&&clearTimeout(window._barcodeTimeout),window._barcodeTimeout=setTimeout(()=>{b.current=""},200))};return window.addEventListener("keydown",o),()=>window.removeEventListener("keydown",o)},[]);const T=r=>{if(!r)return;const o=c.find(t=>t.sku===r||t.id===r);o&&k(o)},k=r=>{p(o=>o.find(s=>s.id===r.id)?o.map(s=>s.id===r.id?{...s,qty:s.qty+1}:s):[...o,{...r,qty:1}])},C=(r,o)=>{p(t=>t.map(s=>s.id===r?{...s,qty:Math.max(0,s.qty+o)}:s).filter(s=>s.qty>0))},v=n.useMemo(()=>d.reduce((r,o)=>r+o.price*o.qty,0),[d]),O=n.useMemo(()=>c.filter(r=>{const o=r.name.toLowerCase().includes(m.toLowerCase())||r.sku.toLowerCase().includes(m.toLowerCase()),t=u==="all"||r.category===u;return o&&t}),[c,m,u]),A=n.useMemo(()=>{const r=new Set(c.map(o=>o.category));return["all",...Array.from(r).sort()]},[c]),E=async()=>{if(!i.name||!i.phone){alert(a("posCustomerRequired")||"Customer Name and Phone are required.");return}N(!0);try{const r={items:d,total:v,customer:i,paymentMethod:x,timestamp:new Date().toISOString(),currency:"BHD",vatIncluded:!0,source:"POS"};await M(r),B(r),h(!1),p([]),f({name:"",phone:""})}catch(r){console.error("Order save error:",r),alert("Failed to save order.")}finally{N(!1)}},B=r=>{const o=window.open("","_blank","width=400,height=600"),t=r.items.map(s=>`
      <tr>
        <td>${s.name} x ${s.qty}</td>
        <td style="text-align:right">BHD ${(s.price*s.qty).toFixed(3)}</td>
      </tr>
    `).join("");o.document.write(`
      <html>
        <head>
          <title>Receipt - Golden Spark</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; padding: 20px; text-align: center; }
            .header { font-weight: bold; font-size: 18px; margin-bottom: 5px; }
            .sub-header { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            td { padding: 5px 0; border-bottom: 1px dashed #ccc; }
            .total { font-weight: bold; font-size: 16px; margin-top: 20px; text-align: right; }
            .footer { margin-top: 30px; font-size: 10px; color: #666; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="header">GOLDEN SPARK</div>
          <div class="sub-header">Premium Custom Controllers<br>Bahrain</div>
          <p style="text-align:left">
            Customer: ${r.customer.name}<br>
            Phone: ${r.customer.phone}<br>
            Date: ${new Date().toLocaleString()}
          </p>
          <table>
            ${t}
          </table>
          <div class="total">TOTAL: BHD ${r.total.toFixed(3)}</div>
          <p style="text-align:right;font-size:10px;">VAT Inclusive</p>
          <div class="footer">Thank you for choosing Golden Spark!</div>
        </body>
      </html>
    `),o.document.close()},_=()=>{const r=l==="ar"?"en":"ar";z(r),localStorage.setItem("ez_lang",r),document.documentElement.dir=r==="ar"?"rtl":"ltr"},$=r=>p(o=>o.filter(t=>t.id!==r));return e.jsxs("div",{className:`pos-app ${l==="ar"?"rtl":"ltr"}`,children:[e.jsxs("header",{className:"pos-header",children:[e.jsxs("div",{className:"pos-brand",children:[e.jsx("div",{className:"logo-spark"}),e.jsxs("div",{children:[e.jsx("h1",{children:"GOLDEN SPARK POS"}),e.jsxs("span",{className:"pos-status",children:[c.length," ",a("posProductsLoaded")||"Products Loaded"]})]})]}),e.jsxs("div",{className:"pos-search",children:[e.jsx("input",{type:"text",placeholder:a("posSearchPlaceholder")||"Search products or scan...",value:m,onChange:r=>q(r.target.value)}),e.jsx("kbd",{className:"kb-hint",children:"MOD + K"})]}),e.jsxs("div",{className:"pos-header-actions",children:[e.jsx("button",{onClick:_,className:"btn-lang-toggle",children:l==="ar"?"English":"العربية"}),e.jsxs("div",{className:"user-profile",children:[e.jsx("div",{className:"avatar",children:"A"}),e.jsx("span",{children:"Admin"})]})]})]}),e.jsxs("div",{className:"pos-layout",children:[e.jsx("aside",{className:"pos-sidebar",children:e.jsxs("div",{className:"sidebar-group",children:[e.jsx("h3",{children:a("posCategories")||"Categories"}),e.jsx("div",{className:"cat-list",children:A.map(r=>e.jsxs("button",{className:`cat-btn ${u===r?"active":""}`,onClick:()=>I(r),children:[e.jsx("span",{className:"cat-dot"}),r==="all"?a("posCatAll")||"All":r]},r))})]})}),e.jsx("main",{className:"pos-main",children:P?e.jsxs("div",{className:"pos-loader-container",children:[e.jsx("div",{className:"pos-spinner"}),e.jsx("span",{children:a("posStatusLoading")||"Syncing Inventory..."})]}):e.jsx("div",{className:"product-grid",children:O.map(r=>e.jsxs("div",{className:"product-card",onClick:()=>k(r),children:[e.jsxs("div",{className:"product-img-wrapper",children:[r.image?e.jsx("img",{src:r.image,alt:r.name,loading:"lazy"}):e.jsx("div",{className:"product-placeholder",children:r.name.charAt(0)}),e.jsx("div",{className:"product-overlay",children:e.jsx("span",{className:"add-icon",children:"+"})})]}),e.jsxs("div",{className:"product-details",children:[e.jsx("span",{className:"product-category",children:r.category}),e.jsx("span",{className:"product-name",children:r.name}),e.jsxs("div",{className:"product-footer",children:[e.jsx("span",{className:"product-sku",children:r.sku}),e.jsxs("span",{className:"product-price",children:["BHD ",r.price.toFixed(3)]})]})]})]},r.id))})}),e.jsx("aside",{className:"pos-checkout-sidebar",children:e.jsxs("div",{className:"cart-container",children:[e.jsxs("div",{className:"cart-header",children:[e.jsx("h3",{children:a("posCartTitle")||"Current Order"}),e.jsx("button",{onClick:()=>p([]),className:"btn-clear-cart",children:a("posClearCart")||"Clear"})]}),e.jsxs("div",{className:"cart-scroll-area",children:[d.length===0&&e.jsxs("div",{className:"cart-empty-state",children:[e.jsx("div",{className:"empty-icon",children:"🛒"}),e.jsx("span",{children:a("posCartEmpty")||"Cart is empty"})]}),d.map(r=>e.jsxs("div",{className:"cart-row",children:[e.jsxs("div",{className:"cart-row-main",children:[e.jsx("span",{className:"cart-row-name",children:r.name}),e.jsxs("span",{className:"cart-row-price",children:["BHD ",(r.price*r.qty).toFixed(3)]})]}),e.jsxs("div",{className:"cart-row-controls",children:[e.jsxs("div",{className:"qty-stepper",children:[e.jsx("button",{onClick:()=>C(r.id,-1),children:"−"}),e.jsx("span",{className:"qty-val",children:r.qty}),e.jsx("button",{onClick:()=>C(r.id,1),children:"+"})]}),e.jsx("button",{onClick:()=>$(r.id),className:"btn-remove-item",children:"×"})]})]},r.id))]}),e.jsxs("div",{className:"cart-checkout-section",children:[e.jsxs("div",{className:"pos-customer-form",children:[e.jsxs("div",{className:"form-field",children:[e.jsx("label",{children:a("posCustomerName")||"Customer Name"}),e.jsx("input",{type:"text",placeholder:"John Doe",value:i.name,onChange:r=>f({...i,name:r.target.value})})]}),e.jsxs("div",{className:"form-field",children:[e.jsx("label",{children:a("posCustomerPhone")||"Phone Number"}),e.jsx("input",{type:"tel",placeholder:"33xxxxxx",value:i.phone,onChange:r=>f({...i,phone:r.target.value})})]})]}),e.jsxs("div",{className:"pos-bill-summary",children:[e.jsxs("div",{className:"bill-line",children:[e.jsx("span",{children:a("posSubtotal")||"Total"}),e.jsxs("span",{className:"bill-val",children:["BHD ",v.toFixed(3)]})]}),e.jsx("div",{className:"bill-notice",children:a("posVatInclusive")||"VAT Inclusive pricing"})]}),e.jsx("button",{className:"btn-pay-now",disabled:d.length===0||g,onClick:()=>h(!0),children:g?a("posProcessing")||"Processing...":a("posCheckout")||"Complete Order"})]})]})})]}),D&&e.jsx("div",{className:"pos-modal-overlay",children:e.jsxs("div",{className:"pos-modal",children:[e.jsxs("header",{className:"modal-header",children:[e.jsx("h2",{children:a("posPaymentMethod")||"Select Payment"}),e.jsx("button",{onClick:()=>h(!1),className:"modal-close",children:"×"})]}),e.jsxs("div",{className:"modal-content",children:[e.jsxs("div",{className:"payment-grid",children:[e.jsxs("button",{className:`pay-method ${x==="cash"?"selected":""}`,onClick:()=>y("cash"),children:[e.jsx("span",{className:"pay-icon",children:"💵"}),e.jsx("span",{children:a("posPayCash")||"Cash"})]}),e.jsxs("button",{className:`pay-method ${x==="card"?"selected":""}`,onClick:()=>y("card"),children:[e.jsx("span",{className:"pay-icon",children:"💳"}),e.jsx("span",{children:a("posPayCard")||"Card"})]}),e.jsxs("button",{className:`pay-method ${x==="transfer"?"selected":""}`,onClick:()=>y("transfer"),children:[e.jsx("span",{className:"pay-icon",children:"📱"}),e.jsx("span",{children:a("posPayBenefit")||"Benefit"})]})]}),e.jsxs("div",{className:"checkout-summary",children:[e.jsxs("div",{className:"summary-row large",children:[e.jsx("span",{children:a("posTotalToPay")||"Amount to Pay"}),e.jsxs("strong",{children:["BHD ",v.toFixed(3)]})]}),e.jsxs("div",{className:"summary-row small",children:[e.jsx("span",{children:a("posVatStatement")||"VAT (Inclusive)"}),e.jsx("span",{children:"-"})]})]})]}),e.jsxs("footer",{className:"modal-footer",children:[e.jsx("button",{onClick:()=>h(!1),className:"btn-cancel-modal",children:a("posCancel")||"Go Back"}),e.jsx("button",{onClick:E,className:"btn-confirm-pay",disabled:g,children:g?"...":a("posConfirmPay")||"Complete & Print Receipt"})]})]})}),e.jsx("style",{dangerouslySetInnerHTML:{__html:`
        :root {
          --pos-bg: #0b0e14;
          --pos-surface: #141a23;
          --pos-border: #232d3d;
          --pos-accent: #38bdf8;
          --pos-text: #f8fafc;
          --pos-text-mute: #94a3b8;
        }

        .pos-app { 
          display: flex; flex-direction: column; height: 100vh; 
          background: var(--pos-bg); color: var(--pos-text); 
          font-family: 'Cairo', system-ui, sans-serif; 
          overflow: hidden;
        }
        .pos-app.rtl { direction: rtl; }

        /* Header */
        .pos-header { 
          height: 70px; padding: 0 2rem; 
          background: var(--pos-surface); border-bottom: 1px solid var(--pos-border);
          display: flex; align-items: center; justify-content: space-between;
          backdrop-filter: blur(10px); z-index: 100;
        }
        .pos-brand { display: flex; align-items: center; gap: 1rem; }
        .logo-spark { width: 32px; height: 32px; background: var(--pos-accent); border-radius: 8px; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4); }
        .pos-brand h1 { margin: 0; font-size: 1.1rem; letter-spacing: 0.05em; color: var(--pos-accent); }
        .pos-status { font-size: 0.7rem; color: var(--pos-text-mute); }

        .pos-search { width: 400px; position: relative; }
        .pos-search input { 
          width: 100%; padding: 0.75rem 1.25rem; 
          background: var(--pos-bg); border: 1px solid var(--pos-border); 
          border-radius: 12px; color: white; font-size: 0.9rem;
          transition: border-color 0.2s;
        }
        .pos-search input:focus { border-color: var(--pos-accent); outline: none; }
        .kb-hint { position: absolute; right: 12px; top: 10px; font-size: 0.65rem; background: var(--pos-border); padding: 2px 6px; border-radius: 4px; }

        .pos-header-actions { display: flex; align-items: center; gap: 1.5rem; }
        .btn-lang-toggle { font-size: 0.85rem; border: 1px solid var(--pos-border); padding: 0.5rem 1rem; border-radius: 8px; }
        .user-profile { display: flex; align-items: center; gap: 0.75rem; }
        .avatar { width: 32px; height: 32px; background: var(--pos-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }

        /* Layout */
        .pos-layout { display: grid; grid-template-columns: 240px 1fr 380px; flex: 1; overflow: hidden; }

        /* Sidebar */
        .pos-sidebar { background: var(--pos-surface); border-inline-end: 1px solid var(--pos-border); padding: 1.5rem; }
        .sidebar-group h3 { font-size: 0.85rem; color: var(--pos-text-mute); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1rem; }
        .cat-list { display: flex; flex-direction: column; gap: 0.35rem; }
        .cat-btn { 
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.85rem 1rem; border-radius: 10px; text-align: start; 
          transition: all 0.2s; color: var(--pos-text-mute);
        }
        .cat-btn:hover { background: var(--pos-border); color: white; }
        .cat-btn.active { background: rgba(56, 189, 248, 0.1); color: var(--pos-accent); font-weight: bold; }
        .cat-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        /* Main Grid */
        .pos-main { padding: 2rem; background: var(--pos-bg); overflow-y: auto; }
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1.5rem; }
        .product-card { 
          background: var(--pos-surface); border-radius: 20px; border: 1px solid var(--pos-border);
          overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .product-card:hover { transform: translateY(-5px); border-color: var(--pos-accent); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
        .product-img-wrapper { height: 160px; position: relative; background: #1a2333; overflow: hidden; }
        .product-img-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .product-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 3rem; background: linear-gradient(135deg, #1e293b, #0f172a); color: var(--pos-accent); opacity: 0.5; }
        .product-overlay { position: absolute; inset: 0; background: rgba(56, 189, 248, 0.2); opacity: 0; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s; }
        .product-card:hover .product-overlay { opacity: 1; }
        .add-icon { width: 40px; height: 40px; background: var(--pos-accent); border-radius: 50%; color: #0f172a; font-size: 1.5rem; display: flex; align-items: center; justify-content: center; }

        .product-details { padding: 1rem; }
        .product-category { font-size: 0.65rem; color: var(--pos-accent); text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 4px; }
        .product-name { font-size: 0.95rem; font-weight: 600; display: block; margin-bottom: 12px; height: 1.2em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .product-footer { display: flex; justify-content: space-between; align-items: baseline; }
        .product-sku { font-size: 0.7rem; color: var(--pos-text-mute); font-family: monospace; }
        .product-price { font-size: 1.1rem; font-weight: 800; color: white; }

        /* Sidebar Checkout */
        .pos-checkout-sidebar { background: var(--pos-surface); border-inline-start: 1px solid var(--pos-border); }
        .cart-container { height: 100%; display: flex; flex-direction: column; }
        .cart-header { padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pos-border); }
        .btn-clear-cart { font-size: 0.8rem; color: #ef4444; }

        .cart-scroll-area { flex: 1; overflow-y: auto; padding: 1rem; }
        .cart-empty-state { text-align: center; margin-top: 100px; color: var(--pos-text-mute); }
        .empty-icon { font-size: 3rem; margin-bottom: 1rem; opacity: 0.1; }

        .cart-row { background: var(--pos-bg); padding: 1rem; border-radius: 12px; margin-bottom: 0.75rem; border: 1px solid var(--pos-border); }
        .cart-row-main { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .cart-row-name { font-size: 0.85rem; font-weight: 600; }
        .cart-row-price { font-size: 0.9rem; color: var(--pos-accent); font-weight: bold; }
        .cart-row-controls { display: flex; align-items: center; justify-content: space-between; }
        .qty-stepper { display: flex; align-items: center; background: var(--pos-surface); border-radius: 6px; padding: 2px; }
        .qty-stepper button { width: 28px; height: 28px; border-radius: 4px; font-size: 1.1rem; }
        .qty-val { width: 30px; text-align: center; font-size: 0.9rem; font-family: monospace; }
        .btn-remove-item { color: #ef4444; font-size: 1.2rem; }

        .cart-checkout-section { padding: 1.5rem; background: var(--pos-surface); border-top: 2px solid var(--pos-border); }
        .pos-customer-form { display: grid; gap: 0.75rem; margin-bottom: 1.5rem; }
        .form-field label { font-size: 0.75rem; color: var(--pos-text-mute); margin-bottom: 4px; display: block; }
        .form-field input { width: 100%; background: var(--pos-bg); border: 1px solid var(--pos-border); padding: 0.75rem; border-radius: 8px; color: white; }
        
        .pos-bill-summary { margin-bottom: 1.5rem; }
        .bill-line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .bill-val { font-size: 1.6rem; font-weight: 900; color: var(--pos-accent); }
        .bill-notice { font-size: 0.7rem; color: #22c55e; text-align: end; font-weight: bold; text-transform: uppercase; }

        .btn-pay-now { width: 100%; padding: 1.25rem; background: var(--pos-accent); color: #0f172a; border-radius: 15px; font-weight: 800; font-size: 1.1rem; box-shadow: 0 10px 15px -3px rgba(56, 189, 248, 0.2); }
        .btn-pay-now:disabled { opacity: 0.5; filter: grayscale(1); }

        /* Modals */
        .pos-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .pos-modal { background: var(--pos-surface); width: 100%; max-width: 580px; border-radius: 24px; border: 1px solid var(--pos-border); overflow: hidden; animation: modalFadeIn 0.3s ease-out; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        
        .modal-header { padding: 1.5rem 2rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--pos-border); }
        .modal-close { font-size: 2rem; color: var(--pos-text-mute); }
        .modal-content { padding: 2rem; }

        .payment-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 2rem; }
        .pay-method { background: var(--pos-bg); border: 2px solid var(--pos-border); border-radius: 16px; padding: 1.5rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: all 0.2s; }
        .pay-icon { font-size: 2rem; }
        .pay-method.selected { border-color: var(--pos-accent); background: rgba(56, 189, 248, 0.05); }

        .checkout-summary { background: var(--pos-bg); padding: 1.5rem; border-radius: 16px; border: 1px dashed var(--pos-border); }
        .summary-row { display: flex; justify-content: space-between; align-items: center; }
        .summary-row.large { font-size: 1.5rem; margin-bottom: 8px; }
        .summary-row.small { font-size: 0.8rem; color: var(--pos-text-mute); }

        .modal-footer { padding: 1.5rem 2rem; display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; background: rgba(0,0,0,0.2); }
        .btn-cancel-modal { padding: 1.25rem; border-radius: 12px; background: var(--pos-bg); font-weight: bold; }
        .btn-confirm-pay { padding: 1.25rem; border-radius: 12px; background: var(--pos-accent); color: #0f172a; font-weight: 800; font-size: 1.1rem; }

        .pos-loader-container { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: var(--pos-text-mute); }
        .pos-spinner { width: 40px; height: 40px; border: 3px solid var(--pos-border); border-top-color: var(--pos-accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}})]})};export{G as default};
