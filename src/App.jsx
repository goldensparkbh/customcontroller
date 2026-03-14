import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar.jsx';
import LoadingState from './components/LoadingState.jsx';

// Lazy-load heavy pages to reduce initial JS memory footprint.
const HomePage = lazy(() => import('./pages/Home.jsx'));
const ConfiguratorPage = lazy(() => import('./pages/Configurator.jsx'));
const CartPage = lazy(() => import('./pages/Cart.jsx'));
const CheckoutPage = lazy(() => import('./pages/Checkout.jsx'));
const PaymentPage = lazy(() => import('./pages/Payment.jsx'));
const ConfirmationPage = lazy(() => import('./pages/Confirmation.jsx'));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccess.jsx'));
const PaymentFailedPage = lazy(() => import('./pages/PaymentFailed.jsx'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccess.jsx'));
const OrderSummaryPage = lazy(() => import('./pages/OrderSummary.jsx'));
const TrackOrderPage = lazy(() => import('./pages/TrackOrder.jsx'));
const POSPage = lazy(() => import('./pages/POS.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsConditions = lazy(() => import('./pages/TermsConditions.jsx'));
const ReturnPolicy = lazy(() => import('./pages/ReturnPolicy.jsx'));
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin.jsx'));
const AdminPage = lazy(() => import('./pages/Admin.jsx'));

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <LoadingState message="Loading admin..." fullScreen />;
  if (!user) return <Navigate to="/admin/login" replace />;

  return children;
};

function App() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<LoadingState message="Loading..." fullScreen />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/configurator" element={<ConfiguratorPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/confirmation" element={<ConfirmationPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/failed" element={<PaymentFailedPage />} />
          <Route path="/order-success" element={<OrderSuccessPage />} />
          <Route path="/order-summary" element={<OrderSummaryPage />} />
          <Route path="/trackorder" element={<TrackOrderPage />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsConditions />} />
          <Route path="/returns" element={<ReturnPolicy />} />
          
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </Suspense>
    </>
  );
}

export default App;
