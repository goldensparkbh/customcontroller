import React, { useEffect, useState } from 'react';
import { i18n } from '../i18n';
import LoadingState, { LoadingInline } from '../components/LoadingState.jsx';

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

function getDerivedSubtotal(draft) {
  const cart = Array.isArray(draft?.cart) ? draft.cart : [];
  return cart.reduce((sum, item) => sum + getLineItemTotal(item), 0);
}

function getOrderTotals(draft) {
  const subtotal = Number(draft?.subtotal) > 0 ? Number(draft.subtotal) : getDerivedSubtotal(draft);
  const shippingCost = Number(draft?.shippingCost);
  const total = Number(draft?.total) > 0 ? Number(draft.total) : subtotal + (Number.isFinite(shippingCost) && shippingCost > 0 ? shippingCost : 0);
  return { subtotal, total };
}

function normalizeOrderDraft(draft) {
  if (!draft || typeof draft !== "object") return draft;
  const { subtotal, total } = getOrderTotals(draft);
  return {
    ...draft,
    subtotal,
    total
  };
}

const getTapPublicKey = () => String(import.meta.env.VITE_TAP_PUBLIC_KEY || '').trim();

function PaymentPage() {
  const [loading, setLoading] = useState(true);
  const [orderDraft, setOrderDraft] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // UI State
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState(localStorage.getItem("ez_lang") || "ar");

  const t = (key) => (i18n[currentLang] && i18n[currentLang][key]) || key;

  useEffect(() => {
    // Load Order Data
    const draftRaw = localStorage.getItem("ezOrderDraft");
    if (!draftRaw) {
      window.location.href = "/cart";
      return;
    }
    const normalizedDraft = normalizeOrderDraft(JSON.parse(draftRaw));
    setOrderDraft(normalizedDraft);
    localStorage.setItem("ezOrderDraft", JSON.stringify(normalizedDraft));
    setLoading(false);
  }, []);

  // Sync Theme & Lang
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  }, [currentLang]);


  const handlePay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setPaymentStatus("");

    const tapPk = getTapPublicKey();
    if (!tapPk) {
      setPaymentStatus(t("tapPublicKeyMissing"));
      setIsProcessing(false);
      return;
    }

    const normalizedDraft = normalizeOrderDraft(orderDraft);
    const totalAmount = normalizedDraft.total;
    const customerName = orderDraft.fullName || "Guest";
    const [firstName, ...restName] = customerName.split(" ");
    const lastName = restName.join(" ") || firstName || ".";
    const email = orderDraft.email || "test@example.com";
    const phone = orderDraft.phone || "00000000";
    const countryCode = orderDraft.phonePrefix || "973";

    if (!(totalAmount > 0)) {
      setPaymentStatus(t("paymentStartFailed") + ": Invalid order total");
      setIsProcessing(false);
      return;
    }

    setOrderDraft(normalizedDraft);
    localStorage.setItem("ezOrderDraft", JSON.stringify(normalizedDraft));

    try {
      const response = await fetch('/api/tap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalAmount,
          currency: "BHD",
          customer: {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: {
              country_code: countryCode,
              number: phone
            }
          },
          redirect_url: window.location.origin + "/payment/success",
          post_url: window.location.origin.includes("localhost")
            ? "http://localhost:5001/ps5-controller/us-central1/tapWebhook"
            : undefined,
          public_key: tapPk
        })
      });

      const result = await parseJsonSafe(response);

      if (!response.ok) {
        const detail =
          (result && (result.error || result.detail || result.message)) ||
          `HTTP ${response.status}`;
        throw new Error(detail);
      }

      if (result && result.transaction && result.transaction.url) {
        window.location.href = result.transaction.url;
      } else {
        throw new Error("No payment URL received");
      }

    } catch (err) {
      console.error("Payment Error:", err);
      setPaymentStatus(t("paymentStartFailed") + ": " + err.message);
      setIsProcessing(false);
    }
  };

  if (loading) return <LoadingState message="Loading payment..." fullScreen />;

  return (
    <div className={`page-content ${mobileNavOpen ? 'mobile-nav-open' : ''}`} style={{ paddingTop: 80, display: "flex", justifyContent: "center" }}>
      <canvas id="bgCanvas" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: -1 }}></canvas>

      {/* Navbars Removed */}

      {/* Payment Card */}
      <div className="card" style={{ maxWidth: 540, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="card-title">{t("paymentTitle")}</div>

        <div id="paymentDetails" style={{ margin: "20px 0", fontSize: "1.1rem", fontWeight: "bold" }}>
          {orderDraft && (
            <>
              {t("totalLabel") || "Total"}: {orderDraft.currencyPrefix || "BHD"} {
                getOrderTotals(orderDraft).total.toFixed(2)
              }
            </>
          )}
        </div>

        <button
          className="place-order-btn"
          type="button"
          onClick={handlePay}
          disabled={isProcessing}
        >
          {isProcessing
            ? <LoadingInline label={t("paymentProcessing") || "Processing..."} />
            : (t("paymentPayNow") || "Pay Now")}
        </button>

        {paymentStatus && (
          <div style={{ marginTop: 15, color: "#ff4444", fontSize: "0.9rem" }}>
            {paymentStatus}
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentPage;
