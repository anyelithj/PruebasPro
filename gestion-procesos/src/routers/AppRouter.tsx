import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Spinner from '../components/accesories/Spinner'
import PrivateRoute from './PrivateRoute'
import PublicRoute from './PublicRoute'

const LandingPage = lazy(() => import('../components/Landing/LandingPage'))
const Login = lazy(() => import('../components/Login'))
const Register = lazy(() => import('../components/Register/Register'))
const DashboardRoutes = lazy(() => import('./DashboardRoutes'))

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/registro"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/app/*"
            element={
              <PrivateRoute>
                <DashboardRoutes />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
