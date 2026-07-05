declare global {
  interface Console {
    parse(v: any): void

    json(v: any, space: number): string
  }

  interface Window {
    umami: {
      track(name: string, data?: any): void
    },
    LA: any,
    dataLayer: any,
    JSZip: any,
  }
}
export {}
