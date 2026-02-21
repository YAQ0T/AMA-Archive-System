/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'
import { normaliseAmountInput, resolveDocumentAmount } from '../utils/amount'

const DEFAULT_FILTERS = {
  name: '',
  amount: '',
  invoiceType: '',
  year: '',
  merchant: '',
  month: '',
}

const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 10,
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const ArchiveContext = createContext(null)

const normaliseAmountFilter = (value) => normaliseAmountInput(value ?? '')

const hydrateDocument = (document) => ({
  ...document,
  amount: resolveDocumentAmount(document),
  invoiceType: document?.invoiceType || '',
})

export const ArchiveProvider = ({ children }) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(null)
  const [hierarchy, setHierarchy] = useState({ years: [] })
  const cacheRef = useRef(new Map())
  const hasBootstrappedRef = useRef(false)

  const serialise = useCallback((value) => JSON.stringify(value), [])

  const loadHierarchy = useCallback(async () => {
    try {
      const data = await api.getHierarchy()
      setHierarchy(data)
      return data
    } catch (apiError) {
      console.error(apiError)
      setHierarchy({ years: [] })
      return { years: [] }
    }
  }, [])

  const fetchArchives = useCallback(
    async (nextFilters = filters, nextPagination = pagination, { force = false } = {}) => {
      const payload = {
        filters: {
          ...DEFAULT_FILTERS,
          ...nextFilters,
          amount: normaliseAmountFilter(nextFilters.amount),
        },
        pagination: {
          ...DEFAULT_PAGINATION,
          ...nextPagination,
        },
      }

      const cacheKey = serialise(payload)

      if (!force && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)
        setArchives(cached.items)
        setHasMore(cached.hasMore)
        setTotalCount(cached.total ?? null)
        return cached.items
      }

      setLoading(true)
      setError('')

      try {
        const { filters: resolvedFilters, pagination: resolvedPagination } = payload
        const skip = (resolvedPagination.page - 1) * resolvedPagination.pageSize

        const response = await api.listDocuments({
          name: resolvedFilters.name || undefined,
          amount: resolvedFilters.amount || undefined,
          invoiceType: resolvedFilters.invoiceType || undefined,
          year: resolvedFilters.year || undefined,
          merchant: resolvedFilters.merchant || undefined,
          month: resolvedFilters.month || undefined,
          limit: resolvedPagination.pageSize,
          skip,
          includeTotal: true,
        })

        const documents = Array.isArray(response) ? response : response?.documents || []
        const hydratedDocuments = documents.map(hydrateDocument)
        const totalValue = Array.isArray(response) ? Number.NaN : Number(response?.total)
        const hasTotal = Number.isFinite(totalValue)
        const total = hasTotal ? totalValue : hydratedDocuments.length

        const hasMorePages = hasTotal
          ? resolvedPagination.page < Math.max(1, Math.ceil(total / resolvedPagination.pageSize))
          : documents.length === resolvedPagination.pageSize

        setArchives(hydratedDocuments)
        setHasMore(hasMorePages)
        setTotalCount(total)

        cacheRef.current.set(cacheKey, { items: hydratedDocuments, hasMore: hasMorePages, total })

        return hydratedDocuments
      } catch (apiError) {
        console.error(apiError)
        setError(apiError.message || 'Unable to load archives right now.')
        setArchives([])
        setHasMore(false)
        setTotalCount(null)
        throw apiError
      } finally {
        setLoading(false)
      }
    },
    [filters, pagination, serialise],
  )

  const updateFilters = useCallback(
    async (nextFilters) => {
      const merged = {
        ...filters,
        ...nextFilters,
        amount: normaliseAmountFilter(nextFilters.amount ?? filters.amount),
      }
      setFilters(merged)
      const nextPagination = { ...pagination, page: 1 }
      setPagination(nextPagination)
      await fetchArchives(merged, nextPagination, { force: true })
    },
    [fetchArchives, filters, pagination],
  )

  const changePage = useCallback(
    async (page) => {
      const pageLimit =
        typeof totalCount === 'number' ? Math.max(1, Math.ceil(totalCount / pagination.pageSize)) : Number.POSITIVE_INFINITY
      const safePage = Math.max(1, Math.min(page, pageLimit))
      const nextPagination = { ...pagination, page: safePage }
      setPagination(nextPagination)
      await fetchArchives(filters, nextPagination)
    },
    [fetchArchives, filters, pagination, totalCount],
  )

  const changePageSize = useCallback(
    async (size) => {
      const numeric = Number(size)
      const safeSize = PAGE_SIZE_OPTIONS.includes(numeric) ? numeric : DEFAULT_PAGINATION.pageSize
      const nextPagination = {
        page: 1,
        pageSize: safeSize,
      }

      setPagination(nextPagination)
      await fetchArchives(filters, nextPagination, { force: true })
    },
    [fetchArchives, filters],
  )

  const refresh = useCallback(async () => {
    cacheRef.current.clear()
    await Promise.all([
      fetchArchives(filters, pagination, { force: true }),
      loadHierarchy(),
    ])
  }, [fetchArchives, filters, loadHierarchy, pagination])

  const editDocument = useCallback(
    async (id, updates) => {
      const payload = {}

      if (updates.notes !== undefined) {
        payload.notes = updates.notes
      }

      if (updates.tags !== undefined) {
        payload.tags = updates.tags
      }

      if (updates.amount !== undefined) {
        payload.amount = updates.amount
      }

      if (updates.invoiceType !== undefined) {
        payload.invoiceType = updates.invoiceType
      }

      if (updates.year !== undefined) {
        payload.year = updates.year
      }

      if (updates.merchant !== undefined) {
        payload.merchant = updates.merchant
      }

      if (updates.month !== undefined) {
        payload.month = updates.month
      }

      const updated = await api.updateDocument(id, payload)

      cacheRef.current.clear()

      await Promise.all([
        fetchArchives(filters, pagination, { force: true }),
        loadHierarchy(),
      ])

      return updated
    },
    [fetchArchives, filters, loadHierarchy, pagination],
  )

  const deleteDocument = useCallback(
    async (id) => {
      await api.deleteDocument(id)

      cacheRef.current.clear()

      const expectedTotal =
        typeof totalCount === 'number' ? Math.max(0, totalCount - 1) : null
      const expectedMaxPage =
        expectedTotal === null ? null : Math.max(1, Math.ceil(expectedTotal / pagination.pageSize))

      const nextPagination =
        expectedMaxPage !== null && pagination.page > expectedMaxPage
          ? { ...pagination, page: expectedMaxPage }
          : pagination

      if (nextPagination !== pagination) {
        setPagination(nextPagination)
      }

      await Promise.all([
        fetchArchives(filters, nextPagination, { force: true }),
        loadHierarchy(),
      ])
    },
    [fetchArchives, filters, loadHierarchy, pagination, totalCount],
  )

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return
    }
    hasBootstrappedRef.current = true
    fetchArchives().catch(() => {})
    loadHierarchy().catch(() => {})
  }, [fetchArchives, loadHierarchy])

  const value = useMemo(
    () => ({
      filters,
      pagination,
      archives,
      loading,
      error,
      hasMore,
      totalCount,
      updateFilters,
      changePage,
      changePageSize,
      refresh,
      hierarchy,
      reloadHierarchy: loadHierarchy,
      editDocument,
      deleteDocument,
      pageSizeOptions: PAGE_SIZE_OPTIONS,
    }),
    [
      archives,
      changePage,
      error,
      filters,
      hasMore,
      hierarchy,
      loading,
      pagination,
      refresh,
      totalCount,
      updateFilters,
      changePageSize,
      loadHierarchy,
      editDocument,
      deleteDocument,
    ],
  )

  return <ArchiveContext.Provider value={value}>{children}</ArchiveContext.Provider>
}

export const useArchiveContext = () => {
  const context = useContext(ArchiveContext)
  if (!context) {
    throw new Error('useArchiveContext must be used inside an ArchiveProvider')
  }
  return context
}
