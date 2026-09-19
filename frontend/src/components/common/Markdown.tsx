import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Links open in a new tab and never hand the page's window or referrer to the target. */
const components: Components = {
  // react-markdown blanks the href of an unsafe link (e.g. `javascript:`); show its text unlinked.
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  // Remote images would load (and leak the viewer's IP to) whatever URL a biography names,
  // so an image is shown as a plain link to it instead.
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      <a href={src} target="_blank" rel="noopener noreferrer nofollow">
        {alt || src}
      </a>
    ) : null,
}

interface MarkdownProps {
  children: string
}

/**
 * Renders user-written Markdown, including bare URLs (auto-linked by GFM). Raw HTML in the
 * text is not rendered, and `javascript:`-style links are dropped by react-markdown's
 * default URL sanitizing, so a biography can't inject script.
 */
export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
