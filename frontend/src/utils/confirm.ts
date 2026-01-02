// Simple confirmation utility that returns a Promise
// This can be replaced with a proper modal component later
export const confirmAction = (message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const result = window.confirm(message)
    resolve(result)
  })
}





