declare module '*.mdx' {
  import type { ComponentType } from 'react'

  export const frontmatter: {
    title?: string
    description?: string
    date?: string
    cover?: string
    category?: string
    tags?: string[]
    [key: string]: unknown
  }

  const MDXComponent: ComponentType
  export default MDXComponent
}
