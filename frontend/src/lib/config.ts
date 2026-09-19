/**
 * The id of the one shared family tree everybody uses. When set, a person who signs in and
 * isn't a member yet asks to join *this* tree (see `AccessRequestPage`) instead of being
 * offered a brand-new, empty one. Leave it unset to keep the create-your-own-tree behavior.
 */
export const DEFAULT_GIA_PHA_ID: string | undefined = import.meta.env.VITE_GIA_PHA_ID || undefined
