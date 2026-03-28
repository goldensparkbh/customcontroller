import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase'; // Update with proper path if needed
import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  query, 
  where 
} from 'firebase/firestore';

const POS = () => {
  // --- Translations ---
  const [lang, setLang] = useState(localStorage.getItem("ez_lang") || "ar");
  const i18n = window.__EZ_I18N__ || {};
  
  const t = (key) => {
    return (i18n[lang] && i18n[lang][key]) || key;
  };

  // --- State ---
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  
  // Customer Info (Mandatory per User Request)
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  
  // UI State
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // cash, card, transfer
  const [isProcessing, setIsProcessing] = useState(false);

  // Barcode Buffer
  const barcodeBuffer = useRef('');
  
  // --- Initialization ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Normal Items from Firestore 'items' collection
        const itemsSnap = await getDocs(collection(db, 'items'));
        const firestoreNormalItems = itemsSnap.docs.map(docSnap => {
          const it = docSnap.data();
          return {
            id: docSnap.id,
            name: it.name || '',
            sku: it.barcode || it.itemNumber || docSnap.id,
            price: parseFloat(it.sellPrice || it.price || 0),
            stock: it.quantity || 0,
            category: it.category || 'General',
            image: it.images?.[0] || null,
            isCustom: false
          };
        });

        // 2. Fetch Customizable Parts from Firestore 'configurator_parts' collection
        const partsSnap = await getDocs(collection(db, 'configurator_parts'));
        const firestoreParts = partsSnap.docs.map(docSnap => {
          const p = docSnap.data();
          return {
            id: docSnap.id,
            name: p.title || p.name || 'Custom Part',
            sku: `PART-${docSnap.id}`,
            price: 0, 
            stock: 999, 
            category: 'Customization',
            image: p.icon || null,
            isCustom: true
          };
        });

        setItems([...firestoreNormalItems, ...firestoreParts]);
      } catch (err) {
        console.error("POS Fetch Error:", err);
        setError("Failed to load products from Firestore.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const handleKeydown = (e) => {
      if (e.key === 'Enter') {
        processBarcode(barcodeBuffer.current);
        barcodeBuffer.current = '';
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        // Buffer clear timeout
        if (window._barcodeTimeout) clearTimeout(window._barcodeTimeout);
        window._barcodeTimeout = setTimeout(() => { barcodeBuffer.current = ''; }, 200);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const processBarcode = (code) => {
    if (!code) return;
    const found = items.find(it => it.sku === code || it.id === code);
    if (found) addToCart(found);
  };

  // --- Actions ---
  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === product.id);
      if (existing) {
        return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, qty: Math.max(0, c.qty + delta) };
      }
      return c;
    }).filter(c => c.qty > 0));
  };

  const total = useMemo(() => cart.reduce((sum, it) => sum + (it.price * it.qty), 0), [cart]);

  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const matchSearch = it.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          it.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = activeCategory === 'all' || it.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [items, searchQuery, activeCategory]);

  const categories = useMemo(() => {
    const set = new Set(items.map(it => it.category));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const handleCheckout = async () => {
    if (!customer.name || !customer.phone) {
      alert(t("posCustomerRequired") || "Customer Name and Phone are required.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const orderData = {
        items: cart,
        total,
        customer,
        paymentMethod,
        timestamp: serverTimestamp(),
        currency: 'BHD',
        vatIncluded: true,
        source: 'POS'
      };

      await addDoc(collection(db, 'pos_orders'), orderData);
      
      // Print handling
      generateReceipt(orderData);

      setIsCheckingOut(false);
      setCart([]);
      setCustomer({ name: '', phone: '' });
    } catch (err) {
      console.error("Order save error:", err);
      alert("Failed to save order.");
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceipt = (order) => {
    const receiptWindow = window.open('', '_blank', 'width=400,height=600');
    const itemsHtml = order.items.map(it => `
      <tr>
        <td>${it.name} x ${it.qty}</td>
        <td style="text-align:right">BHD ${(it.price * it.qty).toFixed(3)}</td>
      </tr>
    `).join('');

    receiptWindow.document.write(`
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
            Customer: ${order.customer.name}<br>
            Phone: ${order.customer.phone}<br>
            Date: ${new Date().toLocaleString()}
          </p>
          <table>
            ${itemsHtml}
          </table>
          <div class="total">TOTAL: BHD ${order.total.toFixed(3)}</div>
          <p style="text-align:right;font-size:10px;">VAT Inclusive</p>
          <div class="footer">Thank you for choosing Golden Spark!</div>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };
  const toggleLang = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    setLang(nextLang);
    localStorage.setItem("ez_lang", nextLang);
    document.documentElement.dir = nextLang === 'ar' ? 'rtl' : 'ltr';
  };

  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));

  // --- Rendering ---
  return (
    <div className={`pos-app ${lang === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* 1. Header & Search */}
      <header className="pos-header">
        <div className="pos-brand">
          <div className="logo-spark" />
          <div>
            <h1>GOLDEN SPARK POS</h1>
            <span className="pos-status">{items.length} {t("posProductsLoaded") || "Products Loaded"}</span>
          </div>
        </div>
        
        <div className="pos-search">
          <input 
            type="text" 
            placeholder={t("posSearchPlaceholder") || "Search products or scan..."} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="kb-hint">MOD + K</kbd>
        </div>

        <div className="pos-header-actions">
           <button onClick={toggleLang} className="btn-lang-toggle">
             {lang === 'ar' ? 'English' : 'العربية'}
           </button>
           <div className="user-profile">
             <div className="avatar">A</div>
             <span>Admin</span>
           </div>
        </div>
      </header>

      <div className="pos-layout">
        {/* 2. Left Column: Categories */}
        <aside className="pos-sidebar">
          <div className="sidebar-group">
            <h3>{t("posCategories") || "Categories"}</h3>
            <div className="cat-list">
              {categories.map(cat => (
                <button 
                  key={cat} 
                  className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  <span className="cat-dot" />
                  {cat === 'all' ? (t("posCatAll") || "All") : cat}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* 3. Center Column: Products */}
        <main className="pos-main">
          {loading ? (
            <div className="pos-loader-container">
              <div className="pos-spinner" />
              <span>{t("posStatusLoading") || "Syncing Inventory..."}</span>
            </div>
          ) : (
            <div className="product-grid">
              {filteredItems.map(it => (
                <div key={it.id} className="product-card" onClick={() => addToCart(it)}>
                  <div className="product-img-wrapper">
                    {it.image ? (
                        <img src={it.image} alt={it.name} loading="lazy" />
                    ) : (
                        <div className="product-placeholder">{it.name.charAt(0)}</div>
                    )}
                    <div className="product-overlay">
                       <span className="add-icon">+</span>
                    </div>
                  </div>
                  <div className="product-details">
                    <span className="product-category">{it.category}</span>
                    <span className="product-name">{it.name}</span>
                    <div className="product-footer">
                      <span className="product-sku">{it.sku}</span>
                      <span className="product-price">BHD {it.price.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* 4. Right Column: Cart */}
        <aside className="pos-checkout-sidebar">
          <div className="cart-container">
            <div className="cart-header">
              <h3>{t("posCartTitle") || "Current Order"}</h3>
              <button onClick={() => setCart([])} className="btn-clear-cart">{t("posClearCart") || "Clear"}</button>
            </div>
            
            <div className="cart-scroll-area">
              {cart.length === 0 && (
                <div className="cart-empty-state">
                  <div className="empty-icon">🛒</div>
                  <span>{t("posCartEmpty") || "Cart is empty"}</span>
                </div>
              )}
              {cart.map(it => (
                <div key={it.id} className="cart-row">
                  <div className="cart-row-main">
                    <span className="cart-row-name">{it.name}</span>
                    <span className="cart-row-price">BHD {(it.price * it.qty).toFixed(3)}</span>
                  </div>
                  <div className="cart-row-controls">
                    <div className="qty-stepper">
                      <button onClick={() => updateQty(it.id, -1)}>−</button>
                      <span className="qty-val">{it.qty}</span>
                      <button onClick={() => updateQty(it.id, 1)}>+</button>
                    </div>
                    <button onClick={() => removeFromCart(it.id)} className="btn-remove-item">×</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-checkout-section">
              {/* Mandatory Customer Info */}
              <div className="pos-customer-form">
                <div className="form-field">
                  <label>{t("posCustomerName") || "Customer Name"}</label>
                  <input 
                    type="text" 
                    placeholder="John Doe" 
                    value={customer.name}
                    onChange={(e) => setCustomer({...customer, name: e.target.value})}
                  />
                </div>
                <div className="form-field">
                  <label>{t("posCustomerPhone") || "Phone Number"}</label>
                  <input 
                    type="tel" 
                    placeholder="33xxxxxx" 
                    value={customer.phone}
                    onChange={(e) => setCustomer({...customer, phone: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="pos-bill-summary">
                <div className="bill-line">
                  <span>{t("posSubtotal") || "Total"}</span>
                  <span className="bill-val">BHD {total.toFixed(3)}</span>
                </div>
                <div className="bill-notice">
                   {t("posVatInclusive") || "VAT Inclusive pricing"}
                </div>
              </div>
              
              <button 
                className="btn-pay-now" 
                disabled={cart.length === 0 || isProcessing}
                onClick={() => setIsCheckingOut(true)}
              >
                {isProcessing ? t("posProcessing") || "Processing..." : (t("posCheckout") || "Complete Order")}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 5. Checkout Modal */}
      {isCheckingOut && (
        <div className="pos-modal-overlay">
          <div className="pos-modal">
            <header className="modal-header">
               <h2>{t("posPaymentMethod") || "Select Payment"}</h2>
               <button onClick={() => setIsCheckingOut(false)} className="modal-close">&times;</button>
            </header>
            
            <div className="modal-content">
              <div className="payment-grid">
                <button className={`pay-method ${paymentMethod === 'cash' ? 'selected' : ''}`} onClick={() => setPaymentMethod('cash')}>
                  <span className="pay-icon">💵</span>
                  <span>{t("posPayCash") || "Cash"}</span>
                </button>
                <button className={`pay-method ${paymentMethod === 'card' ? 'selected' : ''}`} onClick={() => setPaymentMethod('card')}>
                  <span className="pay-icon">💳</span>
                  <span>{t("posPayCard") || "Card"}</span>
                </button>
                <button className={`pay-method ${paymentMethod === 'transfer' ? 'selected' : ''}`} onClick={() => setPaymentMethod('transfer')}>
                  <span className="pay-icon">📱</span>
                  <span>{t("posPayBenefit") || "Benefit"}</span>
                </button>
              </div>

              <div className="checkout-summary">
                 <div className="summary-row large">
                    <span>{t("posTotalToPay") || "Amount to Pay"}</span>
                    <strong>BHD {total.toFixed(3)}</strong>
                 </div>
                 <div className="summary-row small">
                    <span>{t("posVatStatement") || "VAT (Inclusive)"}</span>
                    <span>-</span>
                 </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button onClick={() => setIsCheckingOut(false)} className="btn-cancel-modal">{t("posCancel") || "Go Back"}</button>
              <button onClick={handleCheckout} className="btn-confirm-pay" disabled={isProcessing}>
                {isProcessing ? "..." : (t("posConfirmPay") || "Complete & Print Receipt")}
              </button>
            </footer>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />
    </div>
  );
};

export default POS;
