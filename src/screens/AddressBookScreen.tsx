import React, { useState } from 'react'
import { ArrowLeft, UserPlus, Search, Copy } from 'lucide-react'
import { useRouter } from '../contexts/RouterContext'

interface Contact {
  name: string
  address: string
}

const MOCK_CONTACTS: Contact[] = [
  { name: 'Alice (Cold)',  address: 'AL1c3xG8mPqRuV7wYzK4NjFhDEsT2XoBnCv9dM5Wx8J' },
  { name: 'Bob Mobile',   address: 'BoBMkL9zRv2sXqY7mHpDcT4FnWuGjEa5i3oC8NbKs2Z' },
]

export function AddressBookScreen() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')

  const filtered = MOCK_CONTACTS.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()),
  )

  const copyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
    } catch { /* ignore */ }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/settings')}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors text-text-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="text-text-primary font-heading font-semibold">Address Book</div>
        </div>
        <button type="button" aria-label="Add contact"
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
          style={{ background: 'var(--surface-2)' }}>
          <UserPlus className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input type="text" placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-text-primary text-sm" />
        </div>

        {filtered.length > 0 ? (
          <div className="rounded-2xl helio-card overflow-hidden">
            {filtered.map((contact, i) => (
              <div key={contact.address}
                className={cn('flex items-center gap-3 px-4 py-3.5', i < filtered.length - 1 && 'border-b')}
                style={i < filtered.length - 1 ? { borderColor: 'var(--border-subtle)' } : {}}>
                <div className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm text-accent-primary-foreground shrink-0"
                  style={{ background: 'var(--accent-primary)' }}>
                  {contact.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-text-primary font-medium text-sm">{contact.name}</div>
                  <div className="text-text-muted text-xs font-mono truncate">{contact.address}</div>
                </div>
                <button type="button" aria-label="Copy address" onClick={() => copyAddress(contact.address)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:text-text-primary transition-colors">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-10 space-y-3">
            <div className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--surface-2)' }}>
              <UserPlus className="h-6 w-6 text-text-muted" />
            </div>
            <p className="font-semibold text-text-primary">
              {search ? 'No contacts found' : 'No contacts yet'}
            </p>
            <p className="text-sm text-text-muted max-w-[240px]">
              {search ? 'No contacts match your search.' : 'Save frequent addresses to make sending faster.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
