
import React, { useEffect, useState } from 'react';

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function getLineItemTotal(item) {
  const qty = item.quantity || 1;
  const unit = item.unitPrice ?? item.total ?? 0;
  return Number(unit) * qty;
}

function normalizeOrderDraft(draft) {
  const cart = Array.isArray(draft?.cart) ? draft.cart : [];
  const derivedSubtotal = cart.reduce((sum, item) => sum + getLineItemTotal(item), 0);
  const subtotal = Number(draft?.subtotal) > 0 ? Number(draft.subtotal) : derivedSubtotal;
  const shippingCost = Number(draft?.shippingCost);
  const total = Number(draft?.total) > 0 ? Number(draft.total) : subtotal + (Number.isFinite(shippingCost) && shippingCost > 0 ? shippingCost : 0);

  return {
    ...draft,
    subtotal,
    total
  };
}

function PaymentSuccessPage() {
  const [status, setStatus] = useState("verifying"); // verifying, success, failed
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const verifyAndCreateOrder = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tapId = urlParams.get('tap_id');

        if (!tapId) {
          throw new Error("Missing payment ID");
        }

        // 1. Verify Payment
        setMessage("Verifying payment with Tap...");
        const verifyRes = await fetch(`/api/tap/verify?tap_id=${tapId}`);
        const verifyJson = await parseJsonSafe(verifyRes);

        if (!verifyRes.ok || !verifyJson || (verifyJson.status !== "CAPTURED" && verifyJson.status !== "AUTHORIZED")) {
          console.error("Payment verification failed", verifyJson);
          throw new Error("Payment verification failed: " + ((verifyJson && (verifyJson.status || verifyJson.error || verifyJson.detail)) || `HTTP ${verifyRes.status}`));
        }

        // 2. Create Order
        setMessage("Creating your order...");
        const draftRaw = localStorage.getItem("ezOrderDraft");
        if (!draftRaw) {
          throw new Error("Order draft not found");
        }

        const orderData = normalizeOrderDraft(JSON.parse(draftRaw));
        // Add payment details to order data
        orderData.paymentDetails = verifyJson;
        orderData.paymentMethod = "tap";
        orderData.paymentStatus = "Paid";
        orderData.paymentReference =
          verifyJson.reference?.payment ||
          verifyJson.reference?.transaction ||
          verifyJson.id ||
          tapId;
        localStorage.setItem("ezOrderDraft", JSON.stringify(orderData));

        const createRes = await fetch('/api/createOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        if (!createRes.ok) {
          const result = await parseJsonSafe(createRes);
          throw new Error((result && (result.error || result.detail || result.message)) || "Order creation failed");
        }

        // 3. Success
        setStatus("success");
        setMessage("Payment confirmed and order created!");

        // Clear data
        localStorage.removeItem("ezCart");
        localStorage.removeItem("ezOrderDraft");

        // Wait a moment then redirect
        setTimeout(() => {
          window.location.href = "/";
        }, 5000);

      } catch (err) {
        console.error(err);
        setStatus("failed");
        setMessage(err.message || "Something went wrong");
      }
    };

    verifyAndCreateOrder();
  }, []);

  const successMarkup = `
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title">Pending Confirmation</div>
        <div style="margin:20px 0;">
          <img src="/assets/loading.gif" alt="Loading" style="width:100px; height:auto; display:inline-block;" />
        </div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${message}</div>
      </div>
    </div>
  `;

  const finalMarkup = status === "success" ? `
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" data-i18n="confirmationTitle">Order Confirmed</div>
        <div style="font-size:3rem; margin:20px 0;">✅</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${message}</div>
        <div style="font-size:0.9rem; margin-top:10px; opacity:0.7;">Redirecting home...</div>
      </div>
    </div>
  ` : (status === "failed" ? `
    <canvas id="bgCanvas"></canvas>
    <div class="page-content" style="padding-top:80px; display:flex; justify-content:center;">
      <div class="card" style="max-width:480px; width:100%; text-align:center;">
        <div class="card-title" style="color:#ff4444">Order Failed</div>
        <div style="font-size:3rem; margin:20px 0;">❌</div>
        <div style="font-size:1.2rem; margin:10px 0; font-weight:bold;">${message}</div>
        <button onclick="window.location.href='/checkout'" class="place-order-btn" style="margin-top:20px">Try Again</button>
      </div>
    </div>
  ` : successMarkup);

  return <div dangerouslySetInnerHTML={{ __html: finalMarkup }} />;
}

export default PaymentSuccessPage;
