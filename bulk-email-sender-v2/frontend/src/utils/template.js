/** Replace every {placeholder} (case-sensitive) with the matching contact field. Mirrors the backend. */
export function fillTemplate(text = '', contact = {}) {
  return Object.entries(contact).reduce(
    (out, [key, value]) => out.split(`{${key}}`).join(String(value)),
    text,
  )
}
