import { Navigate, createBrowserRouter } from 'react-router-dom'
import { PageLoadError } from '../components/site-entry'

export const router = createBrowserRouter([
  { path: '/', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/site')).SitePage }) },
  { path: '/admin/preview', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/admin/preview-page')).SitePreviewPage }) },
  { path: '/admin', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/admin')).AdminPage }) },
  { path: '/tasks', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/tasks')).TasksPage }) },
  { path: '*', element: <Navigate to="/" replace /> },
])
