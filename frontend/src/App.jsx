import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth, useAuth } from './auth'
import AppLayout from './components/AppLayout'

const Login = lazy(() => import('./pages/Login'))
const Booking = lazy(() => import('./pages/Booking'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderNew = lazy(() => import('./pages/OrderNew'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const OrderPrint = lazy(() => import('./pages/OrderPrint'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Services = lazy(() => import('./pages/Services'))
const Parts = lazy(() => import('./pages/Parts'))
const Reports = lazy(() => import('./pages/Reports'))
const Expenses = lazy(() => import('./pages/Expenses'))
const Sms = lazy(() => import('./pages/Sms'))
const Users = lazy(() => import('./pages/Users'))
const Settings = lazy(() => import('./pages/Settings'))

const STAFF = ['admin', 'manager']
const ADMIN = ['admin']

function Home() {
  const { user } = useAuth()
  return user?.role === 'mechanic' ? <Navigate to="/orders" replace /> : <Dashboard />
}

const fallback = (
  <div style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>
    <Spin />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/booking" element={<Booking />} />
        <Route
          path="/orders/:id/print"
          element={
            <RequireAuth>
              <OrderPrint />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/new" element={<RequireAuth roles={STAFF}><OrderNew /></RequireAuth>} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="services" element={<Services />} />
          <Route path="parts" element={<Parts />} />
          <Route path="reports" element={<RequireAuth roles={STAFF}><Reports /></RequireAuth>} />
          <Route path="expenses" element={<RequireAuth roles={STAFF}><Expenses /></RequireAuth>} />
          <Route path="sms" element={<RequireAuth roles={STAFF}><Sms /></RequireAuth>} />
          <Route path="users" element={<RequireAuth roles={ADMIN}><Users /></RequireAuth>} />
          <Route path="settings" element={<RequireAuth roles={ADMIN}><Settings /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
