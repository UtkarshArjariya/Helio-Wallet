import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Copy, Plus, Search, Trash2, UserPlus, X,
} from 'lucide-react'
import { ScreenHeader } from '../components/wallet/ui/ScreenHeader'
import { EmptyState } from '../components/wallet/ui/EmptyState'
import { cn } from '../lib/utils'

interface Contact {
  id: string
  label: string
  address: string
  note?: string
  createdAt: string
}

const STORAGE_KEY = 'helio:address-book'

function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Contact[] : []
  } catch { return [] }
}
function saveContacts(c: Contact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

const isValidSolanaAddress = (s: string) =>
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim()) || s.trim().endsWith('.sol')

export function AddressBookScreen() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [query, setQuery]       = useState('')
  const [adding, setAdding]     = useState(false)

  useEffect(() => { setContacts(loadContacts()) }, [])

  const filtered = useMemo(
    () => contacts.filter(c =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.address.toLowerCase().includes(query.toLowerCase())),
    [contacts, query],
  )

  const addContact = (c: Contact) => {
    const next = [c, ...contacts]
    setContacts(next); saveContacts(next)
  }
  const removeContact = (id: string) => {
    const next = contacts.filter(c => c.id !== id)
    setContacts(next); saveContacts(next)
  }

  return (
    <div className="flex flex-col">
      <ScreenHeader
        title="Address book"
        subtitle={contacts.length === 0 ? 'No saved contacts' : `${contacts.length} contact${contacts.length === 1 ? '' : 's'}`}
        rightSlot={
          contacts.length > 0 ? (
            <button type="button" aria-label="Add contact"
              onClick={() => setAdding(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:text-text-primary transition-colors"
              style={{ background: 'var(--surface-2)' }}>
              <Plus className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />

      <div className="p-4 space-y-3">
        {contacts.length === 0 ? (
          <EmptyState
            eyebrow="No contacts saved"
            figure="00"
            headline="Save addresses you send to often."
            body="Add a friend, a hardware wallet, or your exchange deposit address. Saved contacts surface as suggestions on the Send screen."
            primary={{ label: 'Add contact', icon: UserPlus, onClick: () => setAdding(true) }}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}>
              <Search className="h-4 w-4 text-text-muted shrink-0" />
              <input
                type="text"
                placeholder="Search contacts"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none placeholder:text-text-muted text-text-primary text-sm"
              />
            </div>

            <div className="rounded-3xl helio-card overflow-hidden divide-y"
              style={{ borderColor: 'var(--border-subtle)' }}>
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-text-muted text-xs">
                  No contacts match "{query}".
                </div>
              ) : (
                filtered.map(c => (
                  <ContactRow key={c.id} contact={c} onRemove={() => removeContact(c.id)} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {adding && (
        <AddContactDialog
          onClose={() => setAdding(false)}
          onSave={(c) => { addContact(c); setAdding(false) }}
        />
      )}
    </div>
  )
}

function ContactRow({ contact, onRemove }: { contact: Contact; onRemove: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(contact.address) } catch { /* ignore */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-surface-3 transition-colors">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-primary/10 text-accent-primary font-mono text-xs font-bold shrink-0">
        {contact.label.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{contact.label}</div>
        <div className="text-text-muted text-[11px] font-mono truncate">
          {contact.address.slice(0, 8)}…{contact.address.slice(-6)}
        </div>
        {contact.note && (
          <div className="text-text-muted text-[10px] truncate">{contact.note}</div>
        )}
      </div>
      <button type="button" onClick={copy} aria-label="Copy address"
        className="opacity-60 hover:opacity-100 text-text-muted hover:text-text-primary transition-opacity">
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onRemove} aria-label="Remove contact"
        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-opacity">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {copied && <span className="font-mono text-success text-[10px]">copied</span>}
    </div>
  )
}

function AddContactDialog({
  onClose, onSave,
}: { onClose: () => void; onSave: (c: Contact) => void }) {
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')

  const valid = label.trim().length > 0 && isValidSolanaAddress(address)

  const submit = () => {
    if (!valid) return
    onSave({
      id: crypto.randomUUID?.() ?? `c_${Date.now()}`,
      label: label.trim(),
      address: address.trim(),
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl helio-card p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="font-heading text-text-primary font-semibold">New contact</div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-muted hover:text-text-primary transition-colors"
            style={{ background: 'var(--surface-2)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="font-eyebrow text-text-muted text-[10px]">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Coinbase deposit, Ledger, Friend"
            className="w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="font-eyebrow text-text-muted text-[10px]">Address</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Solana address or .sol domain"
            className="w-full rounded-2xl border px-4 py-3 text-sm font-mono text-text-primary outline-none placeholder:text-text-muted"
            style={{
              background: 'var(--surface-2)',
              borderColor: address && !isValidSolanaAddress(address) ? 'var(--danger)' : 'var(--border-subtle)',
            }}
          />
          {address && !isValidSolanaAddress(address) && (
            <span className="flex items-center gap-1 text-danger text-[11px]">
              <AlertTriangle className="h-3 w-3" />
              Not a valid Solana address.
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="font-eyebrow text-text-muted text-[10px]">Note <span className="text-text-muted normal-case font-sans tracking-normal">(optional)</span></span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything that helps you remember"
            className="w-full rounded-2xl border px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-subtle)' }}
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className={cn(
            'w-full rounded-full py-3 text-sm font-semibold transition-colors',
            valid
              ? 'bg-accent-primary text-accent-primary-foreground hover:bg-accent-primary-hover'
              : 'text-text-muted cursor-not-allowed',
          )}
          style={!valid ? { background: 'var(--surface-3)' } : {}}
        >
          Save contact
        </button>
      </div>
    </div>
  )
}
