import api from './api'

export interface Widget {
  id: string
  name: string
  description?: string
  widget_type: string
  widget_config: Record<string, any>
  data_sources: Array<{
    source_type: string
    source_id?: string
    query?: string
    parameters?: Record<string, any>
  }>
  is_system: boolean
  tags?: string[]
}

export interface WidgetCreate {
  name: string
  description?: string
  widget_type: string
  widget_config: Record<string, any>
  data_sources: Widget['data_sources']
  display_config?: Record<string, any>
  refresh_interval?: number
  tags?: string[]
}

export interface BusinessPage {
  id: string
  name: string
  description?: string
  page_type: string
  category?: string
  is_active: boolean
  tags?: string[]
}

export interface PageCreate {
  name: string
  description?: string
  page_type?: string
  category?: string
  layout_config: Record<string, any>
  is_public?: boolean
  allowed_roles?: string[]
  tags?: string[]
}

export interface PageData {
  page_id: string
  page_name: string
  page_type: string
  layout: Record<string, any>
  widgets: Record<string, any>
  context?: Record<string, any>
}

export const presentationApi = {
  // Widgets
  createWidget: async (widgetData: WidgetCreate): Promise<Widget> => {
    const response = await api.post('/presentation/widgets', widgetData)
    return response.data
  },

  listWidgets: async (params?: {
    widget_type?: string
    tags?: string[]
  }): Promise<Widget[]> => {
    const response = await api.get('/presentation/widgets', { params })
    return response.data
  },

  getWidget: async (widgetId: string): Promise<Widget> => {
    const response = await api.get(`/presentation/widgets/${widgetId}`)
    return response.data
  },

  getWidgetData: async (
    widgetId: string,
    context?: Record<string, any>
  ) => {
    const response = await api.post(`/presentation/widgets/${widgetId}/data`, {
      context
    })
    return response.data
  },

  // Pages
  createPage: async (pageData: PageCreate): Promise<BusinessPage> => {
    const response = await api.post('/presentation/pages', pageData)
    return response.data
  },

  listPages: async (params?: {
    page_type?: string
    category?: string
  }): Promise<BusinessPage[]> => {
    const response = await api.get('/presentation/pages', { params })
    return response.data
  },

  getPage: async (pageId: string): Promise<BusinessPage> => {
    const response = await api.get(`/presentation/pages/${pageId}`)
    return response.data
  },

  getPageData: async (
    pageId: string,
    context?: Record<string, any>
  ): Promise<PageData> => {
    const response = await api.post(`/presentation/pages/${pageId}/data`, {
      context
    })
    return response.data
  },

  // Direct data aggregation
  aggregateData: async (sources: Array<{
    source_type: string
    source_id?: string
    query?: string
    parameters?: Record<string, any>
  }>, context?: Record<string, any>) => {
    const response = await api.post('/presentation/aggregate', {
      sources,
      context
    })
    return response.data
  }
}
