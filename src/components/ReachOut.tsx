import { wedding } from '../config/wedding'
import { isFeatureEnabled } from '../config/featureFlags'

function telephoneHref(phone: string): string | null {
  const normalized = phone.trim().replace(/[^\d+]/g, '')
  const digits = normalized.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 ? `tel:${normalized}` : null
}

function whatsappHref(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null
  const number = trimmed.replace(/^00/, '').replace(/\D/g, '')
  return number.length >= 8 && number.length <= 15 && number[0] !== '0'
    ? `https://wa.me/${number}`
    : null
}

export function ReachOut() {
  if (!isFeatureEnabled('reachOut')) return null

  const rawContacts: unknown = wedding.reachOut?.contacts
  if (!Array.isArray(rawContacts)) return null
  const contacts = rawContacts.filter((contact): contact is { name: string; phone: string } =>
    typeof contact?.name === 'string' && contact.name.trim().length > 0 &&
    typeof contact?.phone === 'string' && contact.phone.trim().length > 0,
  )
  if (contacts.length === 0) return null

  return (
    <section className="reach-out" id="reach-out" aria-labelledby="reach-out-title">
      <div className="section-shell reach-out__inner">
        <h2 id="reach-out-title">Reach out to us</h2>
        <p className="reach-out__intro">For any questions or further wedding details, please feel free to reach out to us.</p>
        <ul className="reach-out__contacts">
          {contacts.map((contact, index) => {
            const tel = telephoneHref(contact.phone)
            const whatsapp = isFeatureEnabled('whatsapp') ? whatsappHref(contact.phone) : null
            return (
              <li className="reach-out__contact" key={`${contact.name}-${index}`}>
                <h3>{contact.name}</h3>
                <p>{tel ? <a href={tel}>{contact.phone}</a> : contact.phone}</p>
                <div className="reach-out__actions">
                  {tel && (
                    <a className="reach-out__action" href={tel} aria-label={`Call ${contact.name}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.6 2.8 9.4 2l2.1 5.1-2.2 1.7a15.7 15.7 0 0 0 5.9 5.9l1.7-2.2 5.1 2.1-.8 2.8a3 3 0 0 1-3.3 2.1A18.7 18.7 0 0 1 4.5 6.1a3 3 0 0 1 2.1-3.3Z" /></svg>
                    </a>
                  )}
                  {whatsapp && (
                    <a className="reach-out__action reach-out__action--whatsapp" href={whatsapp} aria-label={`Message ${contact.name} on WhatsApp`} target="_blank" rel="noreferrer">
                      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.6 0 .3 5.3.3 11.8c0 2.1.6 4.2 1.6 6L.2 24l6.3-1.7a11.8 11.8 0 0 0 5.6 1.4h.1c6.5 0 11.8-5.3 11.8-11.8 0-3.2-1.2-6.1-3.5-8.4ZM12.2 21.7h-.1c-1.7 0-3.4-.5-4.8-1.3l-.3-.2-3.7 1 1-3.6-.2-.3a9.8 9.8 0 1 1 8.1 4.4Zm5.4-7.3c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.6-.9-2.1-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.8s1.2 3.2 1.4 3.4c.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.6.8.2 1.5.2 2 .1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4 0-.1-.2-.2-.5-.3Z" /></svg>
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
