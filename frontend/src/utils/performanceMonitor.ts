/**
 * Performance monitoring utilities for frontend performance tracking
 * Helps identify and debug performance bottlenecks
 */

interface PerformanceMetrics {
  pageLoadTime: number
  apiResponseTimes: Record<string, number[]>
  componentRenderTimes: Record<string, number[]>
  cacheHitRates: Record<string, { hits: number; misses: number }>
  memoryUsage?: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    pageLoadTime: 0,
    apiResponseTimes: {},
    componentRenderTimes: {},
    cacheHitRates: {}
  }

  private startTime: number = 0
  private observers: MutationObserver[] = []

  constructor() {
    this.startTime = performance.now()
    this.setupPageLoadMonitoring()
  }

  /**
   * Monitor API call performance
   */
  monitorApiCall(apiName: string, startTime: number, endTime: number) {
    const duration = endTime - startTime
    
    if (!this.metrics.apiResponseTimes[apiName]) {
      this.metrics.apiResponseTimes[apiName] = []
    }
    
    this.metrics.apiResponseTimes[apiName].push(duration)
    
    // Log slow API calls
    if (duration > 2000) { // 2 seconds threshold
      console.warn(`⚠️ Slow API call detected: ${apiName} took ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * Monitor component render performance
   */
  monitorComponentRender(componentName: string, renderTime: number) {
    if (!this.metrics.componentRenderTimes[componentName]) {
      this.metrics.componentRenderTimes[componentName] = []
    }
    
    this.metrics.componentRenderTimes[componentName].push(renderTime)
    
    // Log slow renders
    if (renderTime > 100) { // 100ms threshold
      console.warn(`⚠️ Slow component render detected: ${componentName} took ${renderTime.toFixed(2)}ms`)
    }
  }

  /**
   * Track cache hit/miss rates
   */
  trackCacheEvent(cacheKey: string, isHit: boolean) {
    if (!this.metrics.cacheHitRates[cacheKey]) {
      this.metrics.cacheHitRates[cacheKey] = { hits: 0, misses: 0 }
    }
    
    if (isHit) {
      this.metrics.cacheHitRates[cacheKey].hits++
    } else {
      this.metrics.cacheHitRates[cacheKey].misses++
    }
  }

  /**
   * Get cache hit rate percentage
   */
  getCacheHitRate(cacheKey: string): number {
    const stats = this.metrics.cacheHitRates[cacheKey]
    if (!stats) return 0
    
    const total = stats.hits + stats.misses
    return total > 0 ? (stats.hits / total) * 100 : 0
  }

  /**
   * Get average API response time
   */
  getAverageApiResponseTime(apiName: string): number {
    const times = this.metrics.apiResponseTimes[apiName]
    if (!times || times.length === 0) return 0
    
    const sum = times.reduce((a, b) => a + b, 0)
    return sum / times.length
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const totalTime = performance.now() - this.startTime
    
    return {
      totalTime,
      pageLoadTime: this.metrics.pageLoadTime,
      apiPerformance: Object.entries(this.metrics.apiResponseTimes).map(([api, times]) => ({
        api,
        avgTime: this.getAverageApiResponseTime(api),
        callCount: times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times)
      })),
      componentPerformance: Object.entries(this.metrics.componentRenderTimes).map(([component, times]) => ({
        component,
        avgRenderTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
        renderCount: times.length,
        slowRenders: times.filter(time => time > 100).length
      })),
      cachePerformance: Object.entries(this.metrics.cacheHitRates).map(([key, stats]) => ({
        cacheKey: key,
        hitRate: this.getCacheHitRate(key),
        hits: stats.hits,
        misses: stats.misses,
        total: stats.hits + stats.misses
      })),
      memoryUsage: this.getMemoryUsage()
    }
  }

  /**
   * Log performance report to console
   */
  logPerformanceReport() {
    const report = this.getPerformanceReport()
    
    console.group('📊 Performance Report')
    console.log(`⏱️  Total Time: ${report.totalTime.toFixed(2)}ms`)
    console.log(`📄 Page Load Time: ${report.pageLoadTime.toFixed(2)}ms`)
    
    console.group('📡 API Performance')
    report.apiPerformance.forEach(({ api, avgTime, callCount, minTime, maxTime }) => {
      console.log(`${api}: ${avgTime.toFixed(2)}ms avg (${callCount} calls) [${minTime.toFixed(2)}-${maxTime.toFixed(2)}ms]`)
    })
    console.groupEnd()
    
    console.group('🧩 Component Performance')
    report.componentPerformance.forEach(({ component, avgRenderTime, renderCount, slowRenders }) => {
      console.log(`${component}: ${avgRenderTime.toFixed(2)}ms avg (${renderCount} renders, ${slowRenders} slow)`)
    })
    console.groupEnd()
    
    console.group('💾 Cache Performance')
    report.cachePerformance.forEach(({ cacheKey, hitRate, hits, misses }) => {
      console.log(`${cacheKey}: ${hitRate.toFixed(1)}% hit rate (${hits}/${hits + misses} hits)`)
    })
    console.groupEnd()
    
    if (report.memoryUsage) {
      console.log(`🧠 Memory Usage: ${report.memoryUsage.usedJSHeapSize} bytes`)
    }
    
    console.groupEnd()
  }

  /**
   * Private methods
   */
  private setupPageLoadMonitoring() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.metrics.pageLoadTime = performance.now() - this.startTime
      })
    } else {
      this.metrics.pageLoadTime = performance.now() - this.startTime
    }
  }

  private getMemoryUsage(): { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } | null {
    if ('memory' in performance) {
      // @ts-ignore - memory API is not in all browsers
      return {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      }
    }
    return null
  }

  /**
   * Cleanup observers and resources
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

// Global performance monitor instance
let performanceMonitor: PerformanceMonitor | null = null

export function initializePerformanceMonitoring(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor()
  }
  return performanceMonitor
}

export function getPerformanceMonitor(): PerformanceMonitor | null {
  return performanceMonitor
}

// Utility functions for easy monitoring
export function monitorApi(apiName: string, fn: () => Promise<any>): Promise<any> {
  const startTime = performance.now()
  
  return fn().then(result => {
    const endTime = performance.now()
    performanceMonitor?.monitorApiCall(apiName, startTime, endTime)
    return result
  }).catch(error => {
    const endTime = performance.now()
    performanceMonitor?.monitorApiCall(apiName, startTime, endTime)
    throw error
  })
}

export function withPerformanceMonitoring<T>(
  componentName: string, 
  renderFunction: () => T
): T {
  const startTime = performance.now()
  const result = renderFunction()
  const endTime = performance.now()
  
  performanceMonitor?.monitorComponentRender(componentName, endTime - startTime)
  
  return result
}

// Export types
export type { PerformanceMetrics }