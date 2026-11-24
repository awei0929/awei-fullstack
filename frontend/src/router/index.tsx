import { Navigate, createBrowserRouter } from 'react-router-dom'
import { PageLoadError } from '../components/site-entry'

export const router = createBrowserRouter([
  { path: '/', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/site')).SitePage }) },
  { path: '/thoughts', errorElement: <PageLoadError />, lazy: async () => { const { SitePage } = await import('../pages/site'); return { Component: () => <SitePage section="thoughts" /> } } },
  { path: '/works', errorElement: <PageLoadError />, lazy: async () => { const { SitePage } = await import('../pages/site'); return { Component: () => <SitePage section="works" /> } } },
  { path: '/chat', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/chat')).ChatPage }) },
  { path: '/chat/:conversationId', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/chat')).ChatPage }) },
  { path: '/conversation', element: <Navigate to="/chat" replace /> },
  { path: '/resume', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/resume')).ResumePage }) },
  { path: '/admin/preview', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/admin/preview-page')).SitePreviewPage }) },
  { path: '/admin', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/admin')).AdminPage }) },
  { path: '/tasks', errorElement: <PageLoadError />, lazy: async () => ({ Component: (await import('../pages/tasks')).TasksPage }) },
  { path: '*', element: <Navigate to="/" replace /> },
])
