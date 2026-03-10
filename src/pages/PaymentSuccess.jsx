
import React, { useEffect, useState } from 'react';

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
        const verifyJson = await verifyRes.json();

        if (!verifyRes.ok || (verifyJson.status !== "CAPTURED" && verifyJson.status !== "AUTHORIZED")) {
          console.error("Payment verification failed", verifyJson);
          throw new Error("Payment verification failed: " + (verifyJson.status || "Unknown"));
        }

        // 2. Create Order
        setMessage("Creating your order...");
        const draftRaw = localStorage.getItem("ezOrderDraft");
        if (!draftRaw) {
          throw new Error("Order draft not found");
        }

        const orderData = JSON.parse(draftRaw);
        // Add payment details to order data
        orderData.paymentDetails = verifyJson;
        orderData.paymentMethod = "online"; // Ensure backend knows it's online

        const createRes = await fetch('/api/createOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        if (!createRes.ok) {
          const result = await createRes.json();
          throw new Error(result.error || "Order creation failed");
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
