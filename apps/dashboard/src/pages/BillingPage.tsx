import { useState, useEffect } from 'react'
import { CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface BillingStatus {
  plan: string
  planName: string
  price: number
  maxSites: number | null
  planExpiresAt: string | null
  isSuspended: boolean
  hasStripe: boolean
  stripeCustomerId: string | null
}

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: 29,
    description: 'Per piccole attivita',
    features: ['1 hotspot Wi-Fi', 'Fino a 500 utenti/mese', 'Pagine captive personalizzate', 'Statistiche base', 'Supporto email'],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 79,
    description: 'Per attivita in crescita',
    features: ['Fino a 5 hotspot Wi-Fi', 'Utenti illimitati', 'Pagine captive avanzate', 'Statistiche dettagliate', 'Campagne marketing', 'Automazioni', 'Supporto prioritario'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 199,
    description: 'Per grandi organizzazioni',
    features: ['Hotspot illimitati', 'Utenti illimitati', 'White label completo', 'API access', 'SLA garantito', 'Account manager dedicato', 'Integrazioni custom'],
  },
]

const PLAN_COLORS: Record<string, string> = {
  TRIAL: 'bg-gray-100 text-gray-700',
  STARTER: 'bg-blue-100 text-blue-700',
  PRO: 'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
}

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = localStorage.getItem('token')
  const API = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch(API + '/billing/status', {
        headers: { Authorization: 'Bearer ' + token },
      })
      if (!res.ok) throw new Error('Errore nel recupero stato billing')
      const data = await res.json()
      setStatus(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCheckout(plan: string) {
    setLoadingPlan(plan)
    setError(null)
    try {
      const res = await fetch(API + '/billing/checkout', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Errore checkout')
      window.location.href = data.checkoutUrl
    } catch (e: any) {
      setError(e.message)
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    setError(null)
    try {
      const res = await fetch(API + '/billing/portal', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Errore portale')
      window.location.href = data.portalUrl
    } catch (e: any) {
      setError(e.message)
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    )
  }

  const currentPlan = status?.plan || 'TRIAL'
  const badgeClass = PLAN_COLORS[currentPlan] || PLAN_COLORS.TRIAL

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <CreditCard className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-gray-900">Abbonamento</h1>
      </div>

      {status && !status.hasStripe && currentPlan === 'TRIAL' && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Stripe non ancora configurato</p>
            <p className="text-sm text-yellow-700 mt-1">
              Per abilitare i pagamenti, configura le variabili STRIPE_SECRET_KEY, STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_ENTERPRISE nel file .env del server.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Piano attuale</p>
            <div className="flex items-center gap-3">
              <span className={'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ' + badgeClass}>
                {status?.planName || currentPlan}
              </span>
              {status?.isSuspended && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                  Sospeso
                </span>
              )}
            </div>
            {status?.planExpiresAt && (
              <p className="text-sm text-gray-500 mt-2">
                Scade il: {new Date(status.planExpiresAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          {status?.hasStripe && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              {portalLoading ? 'Caricamento...' : 'Gestisci abbonamento'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Scegli il piano</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          return (
            <div
              key={plan.id}
              className={'bg-white rounded-xl border-2 p-6 shadow-sm flex flex-col ' + (isCurrent ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200')}
            >
              {isCurrent && (
                <div className="flex items-center gap-1 text-indigo-600 text-xs font-medium mb-3">
                  <CheckCircle className="h-4 w-4" />
                  Piano attuale
                </div>
              )}
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">{plan.description}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-extrabold text-gray-900">&euro;{plan.price}</span>
                <span className="text-gray-500 text-sm">/mese</span>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={isCurrent || loadingPlan === plan.id}
                className={'w-full py-2.5 px-4 rounded-lg font-medium transition-colors ' + (isCurrent ? 'bg-indigo-100 text-indigo-600 cursor-default' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50')}
              >
                {loadingPlan === plan.id
                  ? 'Caricamento...'
                  : isCurrent
                  ? 'Piano attuale'
                  : 'Abbonati'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
