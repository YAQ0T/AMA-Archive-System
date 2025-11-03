import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/api'

const DEFAULT_FILTERS = {
  name: '',
  minPrice: '',
  maxPrice: '',
  archivePeriod: '',
  tags: [],
  year: '',
  merchant: '',
  month: '',
}

const DEFAULT_PAGINATION = {
  page: 1,
  pageSize: 10,
}

const ArchiveContext = createContext(null)

const normaliseTags = (tags) =>
  tags
    .map((tag) => tag?.trim())
    .filter((tag, index, array) => tag && array.indexOf(tag) === index)

const withinPriceRange = (price, minPrice, maxPrice) => {
  if (minPrice !== '' && Number.isFinite(Number(minPrice)) && Number(price) < Number(minPrice)) {
    return false
  }
  if (maxPrice !== '' && Number.isFinite(Number(maxPrice)) && Number(price) > Number(maxPrice)) {
    return false
  }
  return true
}

const matchesTags = (documentTags, requiredTags) => {
  if (!requiredTags.length) {
    return true
  }
  const lowerTags = requiredTags.map((tag) => tag.toLowerCase())
  return lowerTags.every((tag) =>
    documentTags.some((documentTag) => documentTag.name?.toLowerCase().includes(tag)),
  )
}

export const ArchiveProvider = ({ children }) => {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [hierarchy, setHierarchy] = useState({ years: [] })
  const cacheRef = useRef(new Map())

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
          tags: normaliseTags(nextFilters.tags || []),
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
        return cached.items
      }

      setLoading(true)
      setError('')

      try {
        const { filters: resolvedFilters, pagination: resolvedPagination } = payload
        const skip = (resolvedPagination.page - 1) * resolvedPagination.pageSize

        const apiPrice =
          resolvedFilters.minPrice !== '' && resolvedFilters.minPrice === resolvedFilters.maxPrice
            ? resolvedFilters.minPrice
            : undefined

        const documents = await api.listDocuments({
          name: resolvedFilters.name || undefined,
          archivePeriod: resolvedFilters.archivePeriod || undefined,
          price: apiPrice || undefined,
          year: resolvedFilters.year || undefined,
          merchant: resolvedFilters.merchant || undefined,
          month: resolvedFilters.month || undefined,
          limit: resolvedPagination.pageSize,
          skip,
        })

        const filtered = documents.filter((document) => {
          if (!document.tags?.length) {
            return resolvedFilters.tags.length === 0
          }

          const matchesPrice = document.tags.some((tag) =>
            withinPriceRange(tag.price, resolvedFilters.minPrice, resolvedFilters.maxPrice),
          )
          if (!matchesPrice) {
            return false
          }

          const matchesRequiredTags = matchesTags(document.tags, resolvedFilters.tags)
          return matchesRequiredTags
        })

        const hasMorePages = documents.length === resolvedPagination.pageSize

        setArchives(filtered)
        setHasMore(hasMorePages)

        cacheRef.current.set(cacheKey, { items: filtered, hasMore: hasMorePages })

        return filtered
      } catch (apiError) {
        console.error(apiError)
        setError(apiError.message || 'Unable to load archives right now.')
        setArchives([])
        setHasMore(false)
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
        tags: normaliseTags(nextFilters.tags ?? filters.tags),
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
      const safePage = Math.max(1, page)
      const nextPagination = { ...pagination, page: safePage }
      setPagination(nextPagination)
      await fetchArchives(filters, nextPagination)
    },
    [fetchArchives, filters, pagination],
  )

  const refresh = useCallback(async () => {
    cacheRef.current.clear()
    await Promise.all([
      fetchArchives(filters, pagination, { force: true }),
      loadHierarchy(),
    ])
  }, [fetchArchives, filters, loadHierarchy, pagination])

  useEffect(() => {
    fetchArchives().catch(() => {})
    loadHierarchy().catch(() => {})
  }, [])

  const value = useMemo(
    () => ({
      filters,
      pagination,
      archives,
      loading,
      error,
      hasMore,
      updateFilters,
      changePage,
      refresh,
      hierarchy,
      reloadHierarchy: loadHierarchy,
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
      updateFilters,
      loadHierarchy,
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

