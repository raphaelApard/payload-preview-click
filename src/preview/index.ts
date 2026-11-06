/**
 * The preview page side: the script that posts clicks to the admin, the
 * markers that tell it what each element renders, and link resolution.
 */
export { DEFAULT_LABELS, initPreviewClick, type MessageTarget, type PreviewLabels, type PreviewScriptOptions } from './script'
export {
  BLOCK_ATTRIBUTE,
  BLOCK_MARKER_PATTERN,
  BLOCK_MARKER_PREFIX,
  BLOCK_TYPE_ATTRIBUTE,
  BLOCKS_END,
  FIELD_ATTRIBUTE,
  blockAttributes,
  blockMarker,
  editable,
  readBlockMarker,
  type MarkWhen,
} from './markers'
export {
  linkPath,
  pageLinks,
  pageResolver,
  type PageLink,
  type PageResolverOptions,
  type ResolvePage,
  type ResolvedPage,
} from './links'
export {
  PREVIEW_CLICK,
  PREVIEW_NAVIGATE,
  previewClickMessage,
  previewNavigateMessage,
  type PreviewClickMessage,
  type PreviewNavigateMessage,
} from '../message'
