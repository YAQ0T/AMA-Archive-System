import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ArchiveProvider } from './context/ArchiveContext'
import { ScanUpload } from './pages/ScanUpload'
import { Archives } from './pages/Archives'
import { Search } from './pages/Search'

const ROUTES = {
  '#/scan': {
    title: 'Scan / Upload',
    element: <ScanUpload />,
  },
  '#/archives': {
    title: 'Archives',
    element: <Archives />,
  },
  '#/search': {
    title: 'Search',
    element: <Search />,
  },
}

const DEFAULT_ROUTE = '#/scan'

const resolveRoute = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_ROUTE
  }
  const { hash } = window.location
  if (ROUTES[hash]) {
    return hash
  }
  window.location.hash = DEFAULT_ROUTE
  return DEFAULT_ROUTE
}

function App() {
  const [route, setRoute] = useState(() => resolveRoute())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => {}
    }

    const handleHashChange = () => {
      setRoute(resolveRoute())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const activeRoute = useMemo(() => ROUTES[route] ?? ROUTES[DEFAULT_ROUTE], [route])

  const connectionLabel = useMemo(
    () => (typeof window !== 'undefined' ? window.location.host : 'archive service'),
    [],
  )

  const navigate = (target) => {
    if (typeof window === 'undefined') {
      return
    }
    if (target === route) {
      return
    }
    window.location.hash = target
  }

  return (
    <ArchiveProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <h1 className="brand">AMA Archive</h1>
          <nav>
            {Object.entries(ROUTES).map(([path, descriptor]) => (
              <button
                key={path}
                type="button"
                className={path === route ? 'active' : ''}
                onClick={() => navigate(path)}
                aria-current={path === route ? 'page' : undefined}
              >
                {descriptor.title}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <small>Connected to {connectionLabel}</small>
          </div>
        </aside>
        <main className="main-content">
          <header className="page-header">
            <h2>{activeRoute.title}</h2>
            <p>Manage archive operations with shared filters, stateful caching, and actionable insights.</p>
          </header>
          <div className="page-body">{activeRoute.element}</div>
        </main>
      </div>
    </ArchiveProvider>
  )
}

export default App
