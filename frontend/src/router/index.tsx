import { Navigate, createBrowserRouter } from 'react-router-dom'
import { TasksPage } from '../pages/tasks'

export const router = createBrowserRouter([
  { path: '/', element: <TasksPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
