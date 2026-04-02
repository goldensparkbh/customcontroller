import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { i18n } from '../i18n';
import LoadingState from '../components/LoadingState.jsx';

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

function redirectToCartWithPaymentFailure(code, navigate) {
  try {
    sessionStorage.setItem('ezPaymentFailure', JSON.stringify({ code }));
  } catch (_) {
    /* ignore */
  }
  navigate('/cart', { replace: true });
}

function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  const lang = typeof localStorage !== 'undefined' ? (localStorage.getItem('ez_lang') || 'ar') : 'ar';
  const t = (key) => (i18n[lang] && i18n[lang][key]) || (i18n.en && i18n.en[key]) || key;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const tapId = new URLSearchParams(window.location.search).get('tap_id');
        if (!tapId) {
          redirectToCartWithPaymentFailure('missing_id', navigate);
          return;
        }

        setMessage(t('paymentProcessing') || 'Verifying payment...');
        const verifyRes = await fetch(`/api/tap/verify?tap_id=${encodeURIComponent(tapId)}`);
        const verifyJson = await parseJsonSafe(verifyRes);

        if (cancelled) return;

        if (!verifyRes.ok || !verifyJson || (verifyJson.status !== 'CAPTURED' && verifyJson.status !== 'AUTHORIZED')) {
          redirectToCartWithPaymentFailure('declined', navigate);
          return;
        }

        setMessage(t('processingOrder') || 'Creating your order...');
        const draftRaw = localStorage.getItem('ezOrderDraft');
        if (!draftRaw) {
          redirectToCartWithPaymentFailure('missing_id', navigate);
          return;
        }

        const orderData = normalizeOrderDraft(JSON.parse(draftRaw));
        orderData.paymentDetails = verifyJson;
        orderData.paymentMethod = 'tap';
        orderData.paymentStatus = 'Paid';
        orderData.paymentReference =
          verifyJson.reference?.payment ||
          verifyJson.reference?.transaction ||
          verifyJson.id ||
          tapId;
        localStorage.setItem('ezOrderDraft', JSON.stringify(orderData));

        const createRes = await fetch('/api/createOrder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
        const createResult = await parseJsonSafe(createRes);

        if (cancelled) return;

        if (!createRes.ok) {
          setStatus('order_failed');
          setMessage(
            (createResult && (createResult.error || createResult.detail || createResult.message)) ||
              t('orderFailed') ||
              'Order creation failed'
          );
          return;
        }

        setStatus('success');
        setMessage(t('paymentConfirmed') || 'Payment confirmed and order created!');

        try {
          await fetch('/api/abandonedCart/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: orderData.email,
              abandonSessionId: orderData.abandonSessionId || ''
            })
          });
        } catch (_) {
          /* ignore */
        }
        try {
          localStorage.removeItem('ezAbandonSession');
        } catch (_) {
          /* ignore */
        }

        localStorage.removeItem('ezCart');
        localStorage.removeItem('ezOrderDraft');

        window.setTimeout(() => {
          window.location.href = '/';
        }, 5000);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          redirectToCartWithPaymentFailure('generic', navigate);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status === 'verifying') {
    return (
      <div className="page-content" style={{ paddingTop: 80, display: 'flex', justifyContent: 'center' }}>
        <canvas id="bgCanvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }} />
        <LoadingState message={message || t('paymentProcessing')} fullScreen={false} minHeight="40vh" />
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="page-content" style={{ paddingTop: 80, display: 'flex', justifyContent: 'center' }}>
        <canvas id="bgCanvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }} />
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div className="card-title" data-i18n="confirmationTitle">{t('confirmationTitle')}</div>
          <div style={{ fontSize: '3rem', margin: '20px 0' }}>✅</div>
          <div style={{ fontSize: '1.2rem', margin: '10px 0', fontWeight: 'bold' }}>{message}</div>
          <div style={{ fontSize: '0.9rem', marginTop: 10, opacity: 0.7 }}>{t('redirectingHome')}</div>
        </div>
      </div>
    );
  }

  if (status === 'order_failed') {
    return (
      <div className="page-content" style={{ paddingTop: 80, display: 'flex', justifyContent: 'center' }}>
        <canvas id="bgCanvas" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }} />
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div className="card-title" style={{ color: '#ff4444' }}>{t('orderFailed')}</div>
          <div style={{ fontSize: '3rem', margin: '20px 0' }}>⚠️</div>
          <div style={{ fontSize: '1rem', margin: '10px 0', lineHeight: 1.5 }}>{message}</div>
          <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '1rem' }}>
            {lang === 'ar'
              ? 'تم الدفع لكن تعذّر حفظ الطلب. تواصل معنا مع مرجع الدفع.'
              : 'Payment may have succeeded but the order could not be saved. Contact us with your payment reference.'}
          </p>
          <button type="button" className="place-order-btn" style={{ marginTop: 20 }} onClick={() => navigate('/checkout', { replace: true })}>
            {lang === 'ar' ? 'العودة إلى الدفع' : 'Back to checkout'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default PaymentSuccessPage;
