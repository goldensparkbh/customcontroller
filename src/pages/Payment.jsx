import React, { useEffect, useState } from 'react';
import { i18n } from '../i18n';

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
    setOrderDraft(JSON.parse(draftRaw));
    setLoading(false);
  }, []);

  // Sync Theme & Lang
  useEffect(() => {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
  }, [currentLang]);


  const toggleLang = () => {
    const newLang = currentLang === "ar" ? "en" : "ar";
    localStorage.setItem("ez_lang", newLang);
    setCurrentLang(newLang);
  };

  const handlePay = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setPaymentStatus("");

    const cart = orderDraft.cart || [];
    const totalAmount = cart.reduce((s, it) => s + (it.unitPrice * it.quantity), 0);
    const customerName = orderDraft.fullName || "Guest";
    const [firstName, lastName] = customerName.split(" ");
    const email = orderDraft.email || "test@example.com";
    const phone = orderDraft.phone || "00000000";

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
              country_code: "965", // You might want to parse this better based on user input
              number: phone
            }
          },
          redirect_url: window.location.origin + "/payment/success",
          post_url: window.location.origin.includes("localhost")
            ? "http://localhost:5001/ps5-controller/us-central1/tapWebhook"
            : undefined // In production, this would be your production webhook URL
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Payment initiation failed");
      }

      if (result.transaction && result.transaction.url) {
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

  if (loading) return <div style={{ padding: 50, textAlign: "center" }}>Loading...</div>;

  return (
    <div className={`page-content ${mobileNavOpen ? 'mobile-nav-open' : ''}`} style={{ paddingTop: 80, display: "flex", justifyContent: "center" }}>
      <canvas id="bgCanvas" style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: -1 }}></canvas>

      {/* Top Nav */}
      <div className="top-nav">
        <div className="nav-logo">
          <a className="nav-left" href="/">
            <div className="nav-logo-mark"></div>
            <div className="nav-page-title">{t("paymentTitle")}</div>
          </a>
        </div>
        <button
          className="nav-menu-btn"
          type="button"
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="nav-right">
          <a className="nav-link" href="/#premadeSection">{t("navPremade")}</a>
          <a className="nav-link" href="/#contactSection">{t("navContact")}</a>
          <a className="nav-cta" href="/configurator">{t("navBuildCta")}</a>
          <button className="nav-link nav-lang" onClick={toggleLang}>
            {currentLang === "ar" ? "EN" : "AR"}
          </button>
        </div>
      </div>

      {/* Mobile Nav Overlay & Drawer */}
      <div
        className={`mobile-nav-overlay ${mobileNavOpen ? 'open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      ></div>
      <aside className={`mobile-nav-drawer ${mobileNavOpen ? 'open' : ''}`} aria-hidden={!mobileNavOpen}>
        <a className="mobile-nav-link" href="/#premadeSection">{t("navPremade")}</a>
        <a className="mobile-nav-link" href="/#contactSection">{t("navContact")}</a>
        <a className="mobile-nav-link mobile-nav-cta" href="/configurator">{t("navBuildCta")}</a>
        <button className="mobile-nav-link mobile-nav-lang" onClick={toggleLang}>
          {currentLang === "ar" ? "EN" : "AR"}
        </button>
      </aside>

      {/* Payment Card */}
      <div className="card" style={{ maxWidth: 540, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
        <div className="card-title">{t("paymentTitle")}</div>

        <div id="paymentDetails" style={{ margin: "20px 0", fontSize: "1.1rem", fontWeight: "bold" }}>
          {orderDraft && (
            <>
              {t("totalLabel") || "Total"}: {orderDraft.currencyPrefix || "BHD"} {
                (orderDraft.cart || []).reduce((s, i) => s + (i.unitPrice * i.quantity), 0).toFixed(2)
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
          {isProcessing ? (t("paymentProcessing") || "Processing...") : (t("paymentPayNow") || "Pay Now")}
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
