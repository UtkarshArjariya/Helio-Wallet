import React, { useState } from 'react'
import { ArrowLeft, UserPlus, Search } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { useRouter } from '../contexts/RouterContext'

export function AddressBookScreen() {
  const { navigate } = useRouter()
  const [search, setSearch] = useState('')

  // Placeholder mock data
  const contacts = [
    { name: 'Alice (Cold)', address: 'AL1c...x8J' },
    { name: 'Bob Mobile', address: 'BoBM...9z2' },
  ]

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto h-full flex flex-col pt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/settings')} className="p-2 -ml-2 rounded-full hover:bg-surface-2 transition-colors">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h2 className="font-heading text-xl font-bold">Address Book</h2>
        </div>
        <button className="p-2 rounded-full hover:bg-surface-2 transition-colors text-text-primary">
          <UserPlus className="h-5 w-5" />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <Input 
          className="pl-10 bg-surface-1" 
          placeholder="Search contacts..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length > 0 ? (
        <Card className="overflow-hidden border-border/50">
          <CardContent className="p-0">
            {filtered.map((contact, i) => (
              <div 
                key={contact.address}
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-surface-3 transition-colors ${i !== filtered.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-surface-3 flex items-center justify-center font-bold text-sm">
                    {contact.name[0]}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{contact.name}</h4>
                    <p className="text-xs text-text-muted font-mono mt-0.5">{contact.address}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-surface-2 flex items-center justify-center mb-2">
            <UserPlus className="h-6 w-6 text-text-muted" />
          </div>
          <h3 className="font-bold">No contacts found</h3>
          <p className="text-sm text-text-muted max-w-[250px]">
            {search ? "No contacts match your search." : "Save frequent addresses here to make sending tokens easier."}
          </p>
          {!search && (
            <Button variant="outline" className="mt-4 gap-2">
              <UserPlus className="h-4 w-4" /> Add Contact
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
