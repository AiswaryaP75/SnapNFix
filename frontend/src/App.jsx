import { useEffect, useEffectEvent, useState } from 'react'
import { OpenStreetMap, LocationPickerMap } from './components/OpenStreetMap'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Check, CircleAlert, Clock3,
  Crosshair, Droplets, HardHat, KeyRound, LocateFixed, LogOut, MapPin,
  MessageSquareText, Navigation, Plus, Power, Search, ShieldCheck,
  Sparkles, Trash2, TrafficCone, UserCog, Users, X, Zap,
} from 'lucide-react'
import './App.css'

const roles = {
  citizen: { label: 'Citizen', title: 'Community Reporting', description: 'Report neighborhood issues and track live resolution progress.', icon: MapPin, color: 'blue' },
  officer: { label: 'Municipal Officer', title: 'Municipal Operations', description: 'Review community reports, verify issues, and assign field crews.', icon: ShieldCheck, color: 'purple' },
  worker: { label: 'Field Worker', title: 'Field Operations', description: 'View assigned tasks, post work updates, feedback, and proof of work.', icon: HardHat, color: 'orange' },
  admin: { label: 'Administrator', title: 'System Administration', description: 'Manage staff accounts, credentials, and access roles.', icon: ShieldCheck, color: 'slate' },
}

const initialIssues = [
  {
    id: 'SNF-2841',
    title: 'Water main pipe leaking',
    type: 'Water',
    street: '8th Ave & W 14th St',
    status: 'In progress',
    date: 'Today, 9:42 AM',
    lat: 40.738,
    lng: -73.999,
    color: 'orange',
    reporter: 'Jordan Rivera',
    assignedTo: 'Alex Rivera (Crew #3)',
    updates: [
      {
        status: 'Assigned',
        note: 'Assigned to Crew #3 for urgent pipe inspection.',
        date: 'Today, 9:50 AM',
        updatedBy: { name: 'Officer Chen', role: 'officer' },
      },
      {
        status: 'In progress',
        note: 'Crew is on site replacing the damaged valve. Main water line temporarily shut off for repairs.',
        date: 'Today, 10:15 AM',
        updatedBy: { name: 'Alex Rivera', role: 'worker' },
      }
    ]
  },
  {
    id: 'SNF-2838',
    title: 'Overflowing sanitation bin',
    type: 'Sanitation',
    street: 'Bleecker St, near Grove',
    status: 'Assigned',
    date: 'Today, 8:16 AM',
    lat: 40.733,
    lng: -74.002,
    color: 'amber',
    reporter: 'Maya R.',
    assignedTo: 'Marcus Vance',
    updates: [
      {
        status: 'Verified',
        note: 'Report verified by city inspector.',
        date: 'Today, 8:30 AM',
        updatedBy: { name: 'Officer Chen', role: 'officer' },
      },
      {
        status: 'Assigned',
        note: 'Dispatched Marcus Vance for special sanitation pickup.',
        date: 'Today, 8:45 AM',
        updatedBy: { name: 'Officer Chen', role: 'officer' },
      }
    ]
  },
  {
    id: 'SNF-2832',
    title: 'Streetlight out on main junction',
    type: 'Lighting',
    street: 'W 10th St & Hudson St',
    status: 'Verified',
    date: 'Yesterday, 4:20 PM',
    lat: 40.734,
    lng: -74.009,
    color: 'purple',
    reporter: 'Jon B.',
    updates: [
      {
        status: 'Verified',
        note: 'High-voltage lamp failure confirmed by municipal patrol.',
        date: 'Yesterday, 5:00 PM',
        updatedBy: { name: 'Officer Chen', role: 'officer' },
      }
    ]
  },
  {
    id: 'SNF-2824',
    title: 'Pothole on bicycle lane',
    type: 'Roads',
    street: 'Hudson St, at W 12th',
    status: 'Resolved',
    date: 'Yesterday, 2:10 PM',
    lat: 40.737,
    lng: -74.006,
    color: 'emerald',
    reporter: 'Sam K.',
    assignedTo: 'Carlos Gomez',
    updates: [
      {
        status: 'In progress',
        note: 'Road repair team dispatched with asphalt sealant.',
        date: 'Yesterday, 3:00 PM',
        updatedBy: { name: 'Carlos Gomez', role: 'worker' },
      },
      {
        status: 'Resolved',
        note: 'Pothole completely filled and leveled. Bike lane reopened for public safety.',
        date: 'Yesterday, 4:45 PM',
        updatedBy: { name: 'Carlos Gomez', role: 'worker' },
      }
    ]
  },
]

const categories = [
  { name: 'Roads', icon: TrafficCone },
  { name: 'Sanitation', icon: Trash2 },
  { name: 'Water', icon: Droplets },
  { name: 'Lighting', icon: Zap },
  { name: 'Other', icon: CircleAlert },
]


function issueView(issue) {
  return {
    dbId: issue._id,
    id: issue.ticketId,
    title: issue.title,
    type: issue.category,
    street: issue.location,
    description: issue.description || '',
    photoUrl: issue.photoUrl || '',
    status: issue.status,
    date: new Date(issue.createdAt || Date.now()).toLocaleDateString(),
    lat: issue.coordinates?.lat,
    lng: issue.coordinates?.lng,
    color: issue.status === 'Resolved' ? 'emerald' : issue.status === 'In progress' ? 'orange' : issue.status === 'Assigned' ? 'amber' : issue.status === 'Verified' ? 'purple' : 'blue',
    reporter: issue.reporter?.name || 'Community Member',
    assignedTo: issue.assignedTo?.name || '',
    updates: (issue.updates || []).map((update) => ({
      ...update,
      date: update.createdAt ? new Date(update.createdAt).toLocaleString() : (update.date || new Date().toLocaleString()),
      updatedBy: typeof update.updatedBy === 'object' && update.updatedBy !== null
        ? update.updatedBy
        : { name: 'Field Staff', role: 'worker' }
    })),
  }
}

function App() {
  const initialPath = window.location.pathname.split('/').filter(Boolean)
  let savedUser = null
  try { savedUser = JSON.parse(localStorage.getItem('snapnfix-user') || 'null') } catch { savedUser = null }
  const initialRole = roles[initialPath[1]] ? initialPath[1] : initialPath[0] === 'admin' ? 'admin' : (savedUser?.role || 'citizen')
  const initialScreen = savedUser?.mustChangePassword ? 'password-change' : initialPath[0] === 'login' ? 'login' : initialPath[0] === 'admin' && savedUser?.role === 'admin' ? 'admin' : 'dashboard'
  
  const [screen, setScreen] = useState(initialScreen)
  const [role, setRole] = useState(initialRole)
  const [authMode, setAuthMode] = useState('login')
  const [activeFilter, setActiveFilter] = useState('All reports')
  const [issues, setIssues] = useState(initialIssues)
  const [showReport, setShowReport] = useState(false)
  const [recenterCount, setRecenterCount] = useState(0)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState('')
  const [reportCoords, setReportCoords] = useState(null)
  const [locationMode, setLocationMode] = useState('map')
  const [reportLocation, setReportLocation] = useState('')
  const [selectedIssue, setSelectedIssue] = useState(null)
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('snapnfix-user') || 'null') } catch { return null }
  })
  const [workflow, setWorkflow] = useState(null)
  const [workers, setWorkers] = useState([])
  const [actionBusy, setActionBusy] = useState(false)
  const [staff, setStaff] = useState([])
  const [staffModal, setStaffModal] = useState(null)
  const [metrics, setMetrics] = useState({ reportsThisWeek: 4, awaitingAction: 2, resolvedPercent: 78 })
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(() => Boolean(savedUser?.mustChangePassword))

  const go = (nextScreen, nextRole = role) => {
    setScreen(nextScreen)
    setRole(nextRole)
    setAuthMode('login')
    const path = nextScreen === 'login' ? `/login/${nextRole}` : nextScreen === 'admin' || nextRole === 'admin' ? '/admin' : '/'
    window.history.pushState({}, '', path)
    setNotice('')
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const refreshIssues = async (token = localStorage.getItem('snapnfix-token')) => {
    if (!token) return
    try {
      const scopeQuery = role === 'citizen' ? '?scope=all' : ''
      const response = await fetch(`${apiUrl}/api/issues${scopeQuery}`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.status === 401) {
        localStorage.removeItem('snapnfix-token')
        localStorage.removeItem('snapnfix-user')
        setAccount(null)
        go('login', role)
        return
      }
      if (!response.ok) return
      const issueData = await response.json()
      const updatedIssues = issueData.issues.map(issueView)
      setIssues(updatedIssues)
      setSelectedIssue((current) => current ? updatedIssues.find((issue) => issue.dbId === current.dbId || issue.id === current.id) || current : null)
    } catch { /* Fallback to current issues state */ }
  }

  const refreshMetrics = async (token = localStorage.getItem('snapnfix-token')) => {
    if (!token) return
    try {
      const response = await fetch(`${apiUrl}/api/issues/metrics`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) setMetrics(await response.json())
    } catch { /* dashboard can continue */ }
  }

  const loadAccountData = async (token = localStorage.getItem('snapnfix-token')) => {
    if (!token || account?.mustChangePassword) return
    await refreshIssues(token)
    await refreshMetrics(token)
    if (account?.role === 'admin') {
      try {
        const staffResponse = await fetch(`${apiUrl}/api/admin/staff`, { headers: { Authorization: `Bearer ${token}` } })
        if (staffResponse.ok) {
          const staffResult = await staffResponse.json()
          setStaff(staffResult.staff)
        }
      } catch { /* Ignore staff fetch error in offline */ }
    }
  }

  const refreshAccountOnChange = useEffectEvent(() => loadAccountData())
  const refreshIssuesOnInterval = useEffectEvent(() => refreshIssues())

  useEffect(() => {
    if (!account?.id || account.mustChangePassword) return undefined
    const timeout = window.setTimeout(() => refreshAccountOnChange().catch(() => {}), 0)
    return () => window.clearTimeout(timeout)
  }, [account?.id, account?.mustChangePassword])

  useEffect(() => {
    if (!account?.id || account.mustChangePassword) return undefined
    const interval = window.setInterval(() => refreshIssuesOnInterval().catch(() => {}), 30000)
    return () => window.clearInterval(interval)
  }, [account?.id, account?.mustChangePassword])

  const changePassword = async (event) => {
    event.preventDefault()
    setActionBusy(true)
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch(`${apiUrl}/api/auth/change-password`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('snapnfix-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: data.get('currentPassword'), newPassword: data.get('newPassword') }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to change password.')
      localStorage.setItem('snapnfix-token', result.token)
      localStorage.setItem('snapnfix-user', JSON.stringify(result.user))
      setAccount(result.user)
      setPasswordChangeRequired(false)
      go(result.user.role === 'admin' ? 'admin' : 'dashboard', result.user.role)
      setNotice('Password updated successfully.')
    } catch (error) { setNotice(error.message) }
    finally { setActionBusy(false) }
  }

  const signIn = async (event) => {
    event.preventDefault()
    setBusy(true)
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch(`${apiUrl}/api/auth/${authMode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.get('name'), email: data.get('email'), password: data.get('password'), role }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to sign in')
      localStorage.setItem('snapnfix-token', result.token)
      localStorage.setItem('snapnfix-user', JSON.stringify(result.user))
      setAccount(result.user)
      if (result.user.mustChangePassword) {
        setPasswordChangeRequired(true)
        setScreen('password-change')
        return
      }
      if (result.user.role === 'admin') go('admin', result.user.role)
      else go('dashboard', result.user.role)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setBusy(false)
    }
  }

  const saveStaff = async (event) => {
    event.preventDefault()
    if (!staffModal) return
    setActionBusy(true)
    const fields = new FormData(event.currentTarget)
    const payload = Object.fromEntries(fields.entries())
    if (!payload.password) delete payload.password
    const token = localStorage.getItem('snapnfix-token')
    const isNew = staffModal.mode === 'create'
    try {
      const response = await fetch(`${apiUrl}/api/admin/staff${isNew ? '' : `/${staffModal.member.id}`}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to save staff account.')
      setStaff((current) => isNew ? [...current, result.staff].sort((a, b) => a.name.localeCompare(b.name)) : current.map((member) => member.id === result.staff.id ? result.staff : member))
      setStaffModal(null)
      setNotice(isNew ? 'Staff account created successfully.' : staffModal.mode === 'reset' ? 'Password reset successfully.' : 'Staff account updated.')
    } catch (error) {
      setNotice(error.message)
    } finally {
      setActionBusy(false)
    }
  }

  const toggleStaff = async (member) => {
    setActionBusy(true)
    try {
      const response = await fetch(`${apiUrl}/api/admin/staff/${member.id}`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${localStorage.getItem('snapnfix-token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !member.isActive }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Unable to change account status.')
      setStaff((current) => current.map((item) => item.id === member.id ? result.staff : item))
      setNotice(`${member.name}'s account is now ${result.staff.isActive ? 'active' : 'deactivated'}.`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setActionBusy(false)
    }
  }

  const geocodeLocation = async (location) => {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`)
    if (!response.ok) throw new Error('Unable to find that location. Check the address and try again.')
    const results = await response.json()
    if (!results[0]) throw new Error('Unable to find that location. Check the address and try again.')
    const coordinates = { lat: Number(results[0].lat), lng: Number(results[0].lon) }
    setReportCoords(coordinates)
    return coordinates
  }

  const handlePickCoords = async ({ lat, lng }) => {
    setReportCoords({ lat, lng })
    setLocationMode('map')
    setReportLocation(`Map Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`)
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
      if (response.ok) {
        const data = await response.json()
        if (data.display_name) {
          const parts = data.display_name.split(', ')
          setReportLocation(parts.slice(0, 3).join(', '))
        }
      }
    } catch { /* fallback to coords string */ }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return setNotice('Geolocation is not supported by this browser.')
    setNotice('Finding your current location...')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const coordinates = { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) }
      setLocationMode('current')
      setReportCoords(coordinates)
      setReportLocation(`Current location (${coordinates.lat}, ${coordinates.lng})`)
      setNotice('Current location captured.')
    }, () => setNotice('Unable to access your location. Please select on the OpenStreetMap or enter manually.'))
  }

  const openDirections = (issue) => {
    if (!Number.isFinite(issue.lat) || !Number.isFinite(issue.lng)) {
      setNotice('Directions are unavailable because this report has no map coordinates.')
      return
    }
    window.open(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${issue.lat}%2C${issue.lng}`, '_blank', 'noopener,noreferrer')
  }

  const submitIssue = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const token = localStorage.getItem('snapnfix-token')
    try {
      let coordinates = reportCoords
      if (!coordinates && reportLocation) {
        coordinates = await geocodeLocation(reportLocation)
      }
      if (!coordinates) throw new Error('Please pick a location on OpenStreetMap, choose current location, or enter a valid address.')
      data.set('lat', String(coordinates.lat))
      data.set('lng', String(coordinates.lng))
      if (token) {
        const response = await fetch(`${apiUrl}/api/issues`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to submit report to server.')
        if (result.issue) {
          const formatted = issueView(result.issue)
          setIssues((current) => [formatted, ...current])
          await refreshMetrics(token)
          setShowReport(false)
          setPreview('')
          setReportCoords(null)
          setReportLocation('')
          setNotice('Your report has been submitted and added to OpenStreetMap.')
          return
        }
      }
      // Demo / fallback local submission
      const newIssue = {
        id: `SNF-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        title: data.get('title'),
        type: data.get('category'),
        street: data.get('location'),
        description: data.get('description') || '',
        status: 'Submitted',
        date: 'Just now',
        lat: coordinates.lat,
        lng: coordinates.lng,
        color: 'blue',
        reporter: account?.name || 'You',
        updates: [],
        photoUrl: preview || ''
      }
      setIssues((current) => [newIssue, ...current])
      setShowReport(false)
      setPreview('')
      setReportCoords(null)
      setReportLocation('')
      setNotice('Report submitted successfully.')
    } catch (error) {
      setNotice(error.message)
    }
  }

  const openWorkflow = async (type, issue) => {
    setWorkflow({ type, issue })
    if (type === 'assign' && localStorage.getItem('snapnfix-token')) {
      try {
        const response = await fetch(`${apiUrl}/api/users/workers`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('snapnfix-token')}` },
        })
        const result = await response.json()
        if (response.ok) setWorkers(result.workers)
        else setNotice(result.message || 'Unable to load field worker directory.')
      } catch {
        setWorkers([
          { id: 'w1', name: 'Marcus Vance' },
          { id: 'w2', name: 'Carlos Gomez' },
          { id: 'w3', name: 'Alex Rivera' },
        ])
      }
    }
  }

  const verifyIssue = async (issue) => {
    const token = localStorage.getItem('snapnfix-token')
    if (token && issue.dbId) {
      try {
        const response = await fetch(`${apiUrl}/api/issues/${issue.dbId}/verify`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to verify report.')
        if (result.issue) {
          const updated = issueView(result.issue)
          setIssues((current) => current.map((item) => item.dbId === issue.dbId ? updated : item))
          if (selectedIssue?.dbId === issue.dbId) setSelectedIssue(updated)
          await refreshMetrics(token)
          setNotice(`${issue.id} marked as verified.`)
          return
        }
      } catch (error) {
        setNotice(error.message)
        return
      }
    }
    // Local state fallback
    const verifiedUpdate = {
      status: 'Verified',
      note: 'Report verified by municipal officer.',
      date: new Date().toLocaleString(),
      updatedBy: { name: account?.name || 'Municipal Officer', role: 'officer' },
    }
    setIssues((current) => current.map((item) => {
      if (item.id === issue.id) {
        const updatedObj = {
          ...item,
          status: 'Verified',
          color: 'purple',
          updates: [...(item.updates || []), verifiedUpdate],
        }
        if (selectedIssue?.id === issue.id) setSelectedIssue(updatedObj)
        return updatedObj
      }
      return item
    }))
    setNotice(`${issue.id} verified.`)
  }

  const submitWorkflow = async (event) => {
    event.preventDefault()
    if (!workflow) return
    setActionBusy(true)
    const data = new FormData(event.currentTarget)
    const token = localStorage.getItem('snapnfix-token')
    const issue = workflow.issue
    
    try {
      if (workflow.type === 'assign') {
        const workerId = data.get('workerId')
        const chosenWorker = workers.find((w) => w.id === workerId)?.name || 'Field Worker'
        if (token && issue.dbId) {
          const response = await fetch(`${apiUrl}/api/issues/${issue.dbId}/assign`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ workerId }),
          })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || 'Unable to assign worker.')
          if (result.issue) {
            const updated = issueView(result.issue)
            setIssues((current) => current.map((item) => item.dbId === issue.dbId ? updated : item))
            if (selectedIssue?.dbId === issue.dbId) setSelectedIssue(updated)
            setWorkflow(null)
            setNotice(`${issue.id} assigned to ${result.issue.assignedTo?.name || chosenWorker}.`)
            return
          }
        }
        // Local fallback
        const assignUpdate = {
          status: 'Assigned',
          note: `Assigned to ${chosenWorker}.`,
          date: new Date().toLocaleString(),
          updatedBy: { name: account?.name || 'Municipal Officer', role: 'officer' },
        }
        setIssues((current) => current.map((item) => {
          if (item.id === issue.id) {
            const updatedObj = {
              ...item,
              status: 'Assigned',
              color: 'amber',
              assignedTo: chosenWorker,
              updates: [...(item.updates || []), assignUpdate],
            }
            if (selectedIssue?.id === issue.id) setSelectedIssue(updatedObj)
            return updatedObj
          }
          return item
        }))
        setWorkflow(null)
        setNotice(`${issue.id} assigned to ${chosenWorker}.`)
        return
      }

      // Progress / Worker Feedback update
      if (workflow.type === 'progress') {
        const targetStatus = data.get('status') || issue.status || 'In progress'
        const note = data.get('note') || ''

        if (token && issue.dbId) {
          const response = await fetch(`${apiUrl}/api/issues/${issue.dbId}/progress`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
            body: data,
          })
          const result = await response.json()
          if (response.ok && result.issue) {
            const updated = issueView(result.issue)
            setIssues((current) => current.map((item) => item.dbId === issue.dbId ? updated : item))
            if (selectedIssue?.dbId === issue.dbId) setSelectedIssue(updated)
            await refreshMetrics(token)
            setWorkflow(null)
            setPreview('')
            setNotice(`Worker feedback saved for ${issue.id}. Status: ${targetStatus}.`)
            return
          }
          throw new Error(result.message || 'Failed to save worker feedback.')
        }

        // Local state update when API unavailable / demo mode
        const newUpdate = {
          status: targetStatus,
          note: note || `Work update: ${targetStatus}`,
          photoUrl: preview || '',
          date: new Date().toLocaleString(),
          updatedBy: { name: account?.name || 'Field Worker', role: 'worker' },
        }
        setIssues((current) => current.map((item) => {
          if (item.id === issue.id) {
            const updatedList = [...(item.updates || []), newUpdate]
            const updatedObj = {
              ...item,
              status: targetStatus,
              color: targetStatus === 'Resolved' ? 'emerald' : 'orange',
              updates: updatedList,
            }
            if (selectedIssue?.id === issue.id) setSelectedIssue(updatedObj)
            return updatedObj
          }
          return item
        }))
        setWorkflow(null)
        setPreview('')
        setNotice(`Worker feedback saved for ${issue.id}.`)
      }
    } catch (error) {
      setNotice(error.message)
    } finally {
      setActionBusy(false)
    }
  }

  const mapIssue = issues.find((issue) => Number.isFinite(issue.lat) && Number.isFinite(issue.lng))
  const mapCenter = mapIssue ? [mapIssue.lat, mapIssue.lng] : [40.735, -74.000]

  const filteredIssues = issues.filter((issue) => {
    const matchesFilter = activeFilter === 'All reports'
      ? true
      : activeFilter === 'My reports'
        ? (account && (issue.reporter === account.name || issue.reporter === 'You'))
        : issue.status === activeFilter
    const matchesSearch = `${issue.title} ${issue.street} ${issue.id} ${issue.assignedTo}`.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  // Password Change Screen
  if (screen === 'password-change' && passwordChangeRequired) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-header">
            <div className="brand-logo"><MapPin size={22} /> SnapNFix</div>
            <h2>Set Personal Password</h2>
            <p>Your temporary password must be changed before continuing.</p>
          </div>
          {notice && <div className="notice-banner danger">{notice}</div>}
          <form className="auth-form" onSubmit={changePassword}>
            <label>Current Temporary Password
              <input name="currentPassword" type="password" required />
            </label>
            <label>New Password (min 12 characters)
              <input name="newPassword" type="password" required minLength={12} />
            </label>
            <button className="button button-primary" type="submit" disabled={actionBusy}>
              {actionBusy ? 'Saving...' : 'Set New Password'} <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Login Screen
  if (screen === 'login') {
    const RoleIcon = roles[role].icon
    return (
      <main className="auth-shell">
        <div className="auth-container">
          <header className="auth-topbar">
            <a className="brand-logo" href="/" onClick={(e) => { e.preventDefault(); go('dashboard') }}>
              <MapPin size={22} /> Snap<span>N</span>Fix
            </a>
            <button className="text-button" onClick={() => go('dashboard')}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </header>

          <div className="auth-grid">
            <div className={`auth-banner role-${roles[role].color}`}>
              <div className="role-badge"><RoleIcon size={18} /> {roles[role].label} Portal</div>
              <h1>{roles[role].title}</h1>
              <p>{roles[role].description}</p>
              <div className="auth-feature-list">
                <div><Check size={16} /> Real-time issue tracking & geotagging</div>
                <div><Check size={16} /> Direct worker feedback & status updates</div>
                <div><Check size={16} /> Transparent municipal workflow</div>
              </div>
            </div>

            <div className="auth-form-card">
              <h2>{authMode === 'register' ? 'Create Citizen Account' : `Sign in as ${roles[role].label}`}</h2>
              <p className="auth-subtitle">Enter your credentials to access your workspace.</p>

              {notice && <div className="notice-banner warning">{notice}</div>}

              <form onSubmit={signIn} className="auth-form">
                {authMode === 'register' && (
                  <label>Full Name
                    <input name="name" type="text" placeholder="John Doe" required maxLength={80} />
                  </label>
                )}
                <label>Email Address
                  <input name="email" type="email" placeholder="name@example.com" required />
                </label>
                <label>{authMode === 'register' ? 'Password (min 8 characters, letter & number)' : 'Password'}
                  <input name="password" type="password" placeholder={authMode === 'register' ? 'Must contain letter & number' : '••••••••'} required minLength={authMode === 'register' ? 8 : 6} />
                </label>
                <button className="button button-primary" type="submit" disabled={busy}>
                  {busy ? 'Authenticating...' : authMode === 'register' ? 'Create Account' : 'Sign In'} <ArrowRight size={16} />
                </button>
              </form>

              <div className="role-switch-section">
                <span>Switch Portal:</span>
                <div className="role-switch-pills">
                  {Object.entries(roles).map(([key, item]) => (
                    <button
                      key={key}
                      className={`role-pill ${role === key ? 'active' : ''}`}
                      onClick={() => go('login', key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {role === 'citizen' && (
                <p className="auth-toggle-text">
                  {authMode === 'register' ? 'Already have an account?' : 'Need a citizen account?'}
                  <button onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setNotice('') }}>
                    {authMode === 'register' ? 'Sign In' : 'Register'}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Admin Screen
  if (screen === 'admin' && account?.role === 'admin') {
    const activeCount = staff.filter((m) => m.isActive).length
    const officerCount = staff.filter((m) => m.role === 'officer').length
    const workerCount = staff.filter((m) => m.role === 'worker').length
    const visibleStaff = staff.filter((m) => `${m.name} ${m.email} ${m.role}`.toLowerCase().includes(search.toLowerCase()))

    return (
      <div className="app-layout">
        <header className="navbar">
          <div className="nav-left">
            <a className="brand-logo" href="/admin" onClick={(e) => e.preventDefault()}>
              <MapPin size={20} /> Snap<span>N</span>Fix <span className="admin-tag">ADMIN</span>
            </a>
          </div>
          <div className="nav-right">
            <button className="button button-secondary" onClick={() => go('dashboard', 'citizen')}>
              Community Dashboard <ArrowUpRight size={14} />
            </button>
            <div className="user-profile">
              <span className="user-avatar">{account.name.slice(0, 2).toUpperCase()}</span>
              <span>{account.name}</span>
            </div>
            <button className="button button-outline button-sm" onClick={() => { localStorage.clear(); setAccount(null); go('login', 'admin') }}>
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </header>

        <main className="main-container">
          <div className="page-header">
            <div>
              <h1>Municipal Staff Directory</h1>
              <p>Manage access credentials for municipal officers and field workers.</p>
            </div>
            <button className="button button-primary" onClick={() => setStaffModal({ mode: 'create' })}>
              <Plus size={16} /> Add Staff Member
            </button>
          </div>

          {notice && <div className="notice-banner success">{notice}</div>}

          <div className="stats-grid">
            <div className="stat-card">
              <Users size={20} className="text-blue" />
              <div><strong>{staff.length}</strong><span>Total Staff</span></div>
            </div>
            <div className="stat-card">
              <ShieldCheck size={20} className="text-purple" />
              <div><strong>{officerCount}</strong><span>Officers</span></div>
            </div>
            <div className="stat-card">
              <HardHat size={20} className="text-orange" />
              <div><strong>{workerCount}</strong><span>Field Workers</span></div>
            </div>
            <div className="stat-card">
              <Check size={20} className="text-emerald" />
              <div><strong>{activeCount}</strong><span>Active Accounts</span></div>
            </div>
          </div>

          <div className="table-container">
            <div className="table-header">
              <h2>Staff Accounts</h2>
              <div className="search-bar">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff by name or email..." />
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleStaff.map((member) => (
                  <tr key={member.id}>
                    <td><strong>{member.name}</strong></td>
                    <td>{member.email}</td>
                    <td><span className={`status-badge badge-${member.role}`}>{member.role === 'officer' ? 'Officer' : 'Field Worker'}</span></td>
                    <td><span className={`status-dot ${member.isActive ? 'active' : 'inactive'}`}>{member.isActive ? 'Active' : 'Deactivated'}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="icon-btn" title="Edit" onClick={() => setStaffModal({ mode: 'edit', member })}><UserCog size={15} /></button>
                        <button className="icon-btn" title="Reset Password" onClick={() => setStaffModal({ mode: 'reset', member })}><KeyRound size={15} /></button>
                        <button className="icon-btn" title={member.isActive ? 'Deactivate' : 'Reactivate'} onClick={() => toggleStaff(member)}><Power size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {staffModal && (
          <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setStaffModal(null) }}>
            <div className="modal-box">
              <div className="modal-header">
                <h3>{staffModal.mode === 'create' ? 'Add Staff Member' : staffModal.mode === 'reset' ? 'Reset Password' : 'Edit Staff'}</h3>
                <button className="icon-btn" onClick={() => setStaffModal(null)}><X size={18} /></button>
              </div>
              <form className="modal-form" onSubmit={saveStaff}>
                {staffModal.mode !== 'reset' && (
                  <>
                    <label>Full Name<input name="name" defaultValue={staffModal.member?.name || ''} required /></label>
                    <label>Email Address<input name="email" type="email" defaultValue={staffModal.member?.email || ''} required /></label>
                    <label>Role
                      <select name="role" defaultValue={staffModal.member?.role || 'officer'}>
                        <option value="officer">Municipal Officer</option>
                        <option value="worker">Field Worker</option>
                      </select>
                    </label>
                  </>
                )}
                {staffModal.mode !== 'edit' && (
                  <label>Temporary Password<input name="password" type="password" minLength={12} required placeholder="At least 12 characters" /></label>
                )}
                <div className="modal-actions">
                  <button type="button" className="button button-outline" onClick={() => setStaffModal(null)}>Cancel</button>
                  <button type="submit" className="button button-primary" disabled={actionBusy}>{actionBusy ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Main Dashboard View
  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-left">
          <a className="brand-logo" href="/" onClick={(e) => { e.preventDefault(); go('dashboard') }}>
            <MapPin size={22} /> Snap<span>N</span>Fix
          </a>
          {!account && (
            <div className="portal-quick-tabs">
              {Object.entries(roles).map(([key, item]) => (
                <button
                  key={key}
                  className={`portal-tab ${role === key ? 'active' : ''}`}
                  onClick={() => setRole(key)}
                  title={`Switch to ${item.label} view`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="nav-right">
          {account?.role === 'admin' && (
            <button className="button button-primary button-sm" onClick={() => go('admin', 'admin')}>
              <UserCog size={14} /> Staff Directory
            </button>
          )}
          <div className="user-profile">
            <div className="avatar-circle">{account?.name?.slice(0, 2).toUpperCase() || (role === 'citizen' ? 'JR' : role === 'officer' ? 'MO' : 'FW')}</div>
            <div className="user-details">
              <strong>{account?.name || (role === 'citizen' ? 'Community Guest' : roles[role].label)}</strong>
              <small>{account ? account.role.toUpperCase() : `${roles[role].label} Demo View`}</small>
            </div>
          </div>
          {account ? (
            <button className="button button-outline button-sm" onClick={() => { localStorage.clear(); setAccount(null); go('dashboard', 'citizen') }}>
              <LogOut size={14} /> Sign out
            </button>
          ) : (
            <button className="button button-primary button-sm" onClick={() => go('login', role)}>
              Sign In <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="main-container">
        {/* Banner Section */}
        <section className="hero-banner">
          <div className="hero-text">
            <span className="hero-tag"><Sparkles size={14} /> {roles[role].title}</span>
            <h1>{role === 'citizen' ? 'Report & Track Neighborhood Issues' : role === 'officer' ? 'Verify & Dispatch Municipal Teams' : 'Field Worker Feedback & Work Queue'}</h1>
            <p>{roles[role].description}</p>
          </div>
          {role === 'citizen' && (
            <button className="button button-primary button-lg" onClick={() => { setLocationMode('manual'); setReportLocation(''); setReportCoords(null); setPreview(''); setShowReport(true) }}>
              <Plus size={18} /> Report New Issue
            </button>
          )}
        </section>

        {notice && (
          <div className="notice-banner success">
            <Check size={16} /> {notice}
            <button className="dismiss-btn" onClick={() => setNotice('')}><X size={14} /></button>
          </div>
        )}

        {/* Quick Metrics Cards */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon icon-blue"><CircleAlert size={20} /></div>
            <div>
              <strong>{metrics.reportsThisWeek || issues.length}</strong>
              <span>Reports Active</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon icon-amber"><Clock3 size={20} /></div>
            <div>
              <strong>{metrics.awaitingAction || issues.filter(i => i.status !== 'Resolved').length}</strong>
              <span>Awaiting Action</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon icon-emerald"><Check size={20} /></div>
            <div>
              <strong>{metrics.resolvedPercent || 75}%</strong>
              <span>Resolution Rate</span>
            </div>
          </div>
        </section>

        {/* Map & Issues Content Split */}
        <div className="dashboard-grid">
          {/* Interactive OpenStreetMap Card */}
          <section className="card map-card">
            <div className="card-header">
              <div>
                <h2>Live Issue Map (OpenStreetMap)</h2>
                <p>Showing {filteredIssues.filter((i) => Number.isFinite(i.lat) && Number.isFinite(i.lng)).length} geotagged report pins</p>
              </div>
              <button className="button button-outline button-sm" onClick={() => { setRecenterCount((c) => c + 1); setNotice('Centered on active reports.') }}>
                <LocateFixed size={14} /> Recenter Map
              </button>
            </div>
            <div className="map-wrapper">
              <OpenStreetMap
                issues={filteredIssues}
                center={mapCenter}
                zoom={14}
                selectedIssue={selectedIssue}
                onSelectIssue={(issue) => setSelectedIssue(issue)}
                recenterTrigger={recenterCount}
              />
            </div>
          </section>

          {/* Issue Cards Queue */}
          <section className="card issues-card">
            <div className="card-header border-b">
              <div>
                <h2>Report Queue</h2>
                <p>Real-time updates and worker feedback</p>
              </div>
              <div className="search-input-wrap">
                <Search size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="filter-pills-bar">
              {['All reports', ...(account?.role === 'citizen' ? ['My reports'] : []), 'Submitted', 'Verified', 'Assigned', 'In progress', 'Resolved'].map((f) => (
                <button
                  key={f}
                  className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f} {f === 'All reports' && `(${issues.length})`}
                </button>
              ))}
            </div>

            {/* Issue Cards List */}
            <div className="issues-list">
              {filteredIssues.map((issue) => {
                const latestWorkerUpdate = [...(issue.updates || [])].reverse().find((u) => u.note || u.updatedBy?.role === 'worker') || issue.updates?.[issue.updates.length - 1]

                return (
                  <article className="issue-item-card" key={issue.id}>
                    <div className="issue-item-header">
                      <div className="issue-title-group">
                        <span className={`category-icon category-${issue.color}`}>
                          {issue.type === 'Water' ? <Droplets size={16} /> : issue.type === 'Sanitation' ? <Trash2 size={16} /> : issue.type === 'Lighting' ? <Zap size={16} /> : <TrafficCone size={16} />}
                        </span>
                        <div>
                          <h3>{issue.title}</h3>
                          <span className="issue-meta">{issue.street} • <span className="mono">{issue.id}</span></span>
                        </div>
                      </div>
                      <span className={`status-badge badge-${issue.color}`}>{issue.status}</span>
                    </div>

                    <div className="issue-item-details">
                      <div className="reporter-info">Reported by <strong>{issue.reporter}</strong> on {issue.date}</div>
                      {issue.assignedTo && <div className="assigned-info">Assigned to: <strong>{issue.assignedTo}</strong></div>}
                    </div>

                    {/* PROMINENT WORKER FEEDBACK BOX */}
                    {latestWorkerUpdate && (
                      <div className="worker-feedback-box">
                        <div className="worker-feedback-header">
                          <div className="worker-info-tag">
                            <HardHat size={14} />
                            <strong>{latestWorkerUpdate.updatedBy?.name || 'Field Worker'}</strong>
                            <span className="worker-role-badge">{latestWorkerUpdate.updatedBy?.role === 'officer' ? 'Municipal Note' : 'Field Worker Feedback'}</span>
                          </div>
                          <span className="feedback-time">{latestWorkerUpdate.date}</span>
                        </div>
                        {latestWorkerUpdate.note && <p className="feedback-note">"{latestWorkerUpdate.note}"</p>}
                        {latestWorkerUpdate.photoUrl && (
                          <div className="feedback-photo-preview">
                            <img src={latestWorkerUpdate.photoUrl} alt="Proof" />
                            <span>Proof Photo Attached</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="issue-item-actions">
                      {(role === 'officer' || role === 'worker') && (
                        <button className="button button-outline button-sm" onClick={() => openDirections(issue)}>
                          <Navigation size={14} /> Directions
                        </button>
                      )}
                      {role === 'officer' && (
                        <>
                          {issue.status === 'Submitted' && (
                            <button className="button button-secondary button-sm" onClick={() => verifyIssue(issue)}>
                              <ShieldCheck size={14} /> Verify Report
                            </button>
                          )}
                          {issue.status === 'Verified' && (
                            <button className="button button-primary button-sm" onClick={() => openWorkflow('assign', issue)}>
                              <Users size={14} /> Assign Worker
                            </button>
                          )}
                        </>
                      )}

                      {role === 'worker' && (
                        <button className="button button-primary button-sm" onClick={() => openWorkflow('progress', issue)}>
                          <MessageSquareText size={14} /> Update Feedback & Status
                        </button>
                      )}

                      <button className="button button-outline button-sm" onClick={() => setSelectedIssue(issue)}>
                        View Full Details <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                )
              })}

              {filteredIssues.length === 0 && (
                <div className="empty-state-card">
                  <CircleAlert size={32} />
                  <p>No reports match your selected criteria.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Modal: Report Issue */}
      {showReport && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowReport(false); setPreview('') } }}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>Report a Neighborhood Issue</h3>
                <p>Provide details and geotag the issue for municipal action.</p>
              </div>
              <button className="icon-btn" onClick={() => { setShowReport(false); setPreview('') }}><X size={18} /></button>
            </div>
            <form className="modal-form" onSubmit={submitIssue}>
              <label>Issue Title
                <input name="title" placeholder="e.g. Broken streetlight or road pothole" required maxLength={100} />
              </label>
              <label>Category
                <select name="category" defaultValue="Roads">
                  {categories.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </label>
              <label>Issue Location
                <div className="location-choice" role="group" aria-label="Choose issue location method">
                  <button type="button" className={`location-choice-btn ${locationMode === 'map' ? 'active' : ''}`} onClick={() => setLocationMode('map')}>
                    <Crosshair size={15} /> Pick on Map
                  </button>
                  <button type="button" className={`location-choice-btn ${locationMode === 'current' ? 'active' : ''}`} onClick={useCurrentLocation}>
                    <LocateFixed size={15} /> Current location
                  </button>
                  <button type="button" className={`location-choice-btn ${locationMode === 'manual' ? 'active' : ''}`} onClick={() => { setLocationMode('manual'); setReportCoords(null); setReportLocation('') }}>
                    <MapPin size={15} /> Enter address
                  </button>
                </div>
                {locationMode === 'map' && (
                  <LocationPickerMap
                    selectedCoords={reportCoords}
                    onPickCoords={handlePickCoords}
                    center={mapCenter}
                  />
                )}
                <input name="location" value={reportLocation} onChange={(event) => { setReportLocation(event.target.value); setReportCoords(null) }} placeholder={locationMode === 'map' ? 'Click on the map above to select location' : 'e.g. 8th Ave & W 14th St'} required readOnly={locationMode === 'current'} />
              </label>
              <label>Description (Optional)
                <textarea name="description" rows={3} placeholder="Describe the severity and impact..." maxLength={2000} />
              </label>
              <label>Attach Photo
                <input type="file" accept="image/*" name="photo" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setPreview(URL.createObjectURL(file))
                }} />
              </label>
              {preview && <img className="image-preview" src={preview} alt="Preview" />}
              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => { setShowReport(false); setPreview(''); setReportLocation(''); setReportCoords(null) }}>Cancel</button>
                <button type="submit" className="button button-primary">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Workflow (Assign Worker OR Worker Progress Update) */}
      {workflow && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setWorkflow(null); setPreview('') } }}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <h3>{workflow.type === 'assign' ? 'Assign Field Worker' : 'Post Worker Feedback & Status'}</h3>
                <p>Report: <strong>{workflow.issue.id}</strong> - {workflow.issue.title}</p>
              </div>
              <button className="icon-btn" onClick={() => { setWorkflow(null); setPreview('') }}><X size={18} /></button>
            </div>

            <form className="modal-form" onSubmit={submitWorkflow}>
              {workflow.type === 'assign' ? (
                <label>Select Field Worker
                  <select name="workerId" required defaultValue="">
                    <option value="" disabled>Choose an active worker...</option>
                    {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label>Update Status
                    <select name="status" defaultValue={workflow.issue.status}>
                      {workflow.issue.status === 'Assigned' && <option value="Assigned">Assigned (Add Progress Note)</option>}
                      <option value="In progress">In progress</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </label>
                  <label>Worker Feedback / Progress Note
                    <textarea name="note" rows={3} placeholder="Enter work notes, repair details, or resolution feedback..." required maxLength={500} />
                  </label>
                  <label>Proof Photo (Optional)
                    <input type="file" accept="image/*" name="photo" onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setPreview(URL.createObjectURL(file))
                    }} />
                  </label>
                  {preview && <img className="image-preview" src={preview} alt="Proof preview" />}
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="button button-outline" onClick={() => { setWorkflow(null); setPreview('') }}>Cancel</button>
                <button type="submit" className="button button-primary" disabled={actionBusy}>
                  {actionBusy ? 'Saving...' : workflow.type === 'assign' ? 'Assign Crew' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Issue Details & Worker Feedback History */}
      {selectedIssue && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedIssue(null) }}>
          <div className="modal-box modal-lg">
            <div className="modal-header">
              <div>
                <span className="mono">{selectedIssue.id}</span>
                <h2>{selectedIssue.title}</h2>
              </div>
              <button className="icon-btn" onClick={() => setSelectedIssue(null)}><X size={18} /></button>
            </div>

            <div className="issue-detail-body">
              <div className="issue-detail-bar">
                <span className={`status-badge badge-${selectedIssue.color}`}>{selectedIssue.status}</span>
                <span>Category: <strong>{selectedIssue.type}</strong></span>
                <span>Reported on: <strong>{selectedIssue.date}</strong> by {selectedIssue.reporter}</span>
              </div>

              {selectedIssue.photoUrl && (
                <div className="issue-main-photo">
                  <img src={selectedIssue.photoUrl} alt="Report Photo" />
                </div>
              )}

              <div className="detail-section">
                <h4>Description & Location</h4>
                <p>{selectedIssue.description || 'No description provided.'}</p>
                <div className="location-box">
                  <MapPin size={16} />
                  <span>{selectedIssue.street}</span>
                  <button className="button button-outline button-sm" onClick={() => openDirections(selectedIssue)}>
                    <Navigation size={14} /> Directions
                  </button>
                </div>
                <div className="detail-actions-row">
                  {role === 'officer' && selectedIssue.status === 'Submitted' && (
                    <button className="button button-secondary button-sm" onClick={() => { verifyIssue(selectedIssue); setSelectedIssue(null) }}>
                      <ShieldCheck size={14} /> Verify Report
                    </button>
                  )}
                  {role === 'officer' && selectedIssue.status === 'Verified' && (
                    <button className="button button-primary button-sm" onClick={() => { openWorkflow('assign', selectedIssue); setSelectedIssue(null) }}>
                      <Users size={14} /> Assign Worker
                    </button>
                  )}
                  {role === 'worker' && (
                    <button className="button button-primary button-sm" onClick={() => { openWorkflow('progress', selectedIssue); setSelectedIssue(null) }}>
                      <MessageSquareText size={14} /> Post Feedback & Update Status
                    </button>
                  )}
                </div>
              </div>

              {/* TIMELINE OF WORKER FEEDBACK AND UPDATES */}
              <div className="detail-section">
                <h4>Worker Feedback & Update History</h4>
                {selectedIssue.updates && selectedIssue.updates.length > 0 ? (
                  <div className="updates-timeline">
                    {[...selectedIssue.updates].reverse().map((up, idx) => (
                      <div className={`timeline-item ${up.updatedBy?.role === 'worker' ? 'is-worker' : ''}`} key={idx}>
                        <div className="timeline-header">
                          <div className="timeline-user">
                            {up.updatedBy?.role === 'worker' ? <HardHat size={14} /> : <ShieldCheck size={14} />}
                            <strong>{up.updatedBy?.name || 'Staff Member'}</strong>
                            <span className="role-tag">{up.updatedBy?.role === 'worker' ? 'Field Worker' : 'Municipal Officer'}</span>
                          </div>
                          <span className="timeline-date">{up.date}</span>
                        </div>
                        <span className={`status-badge badge-sm badge-${up.status === 'Resolved' ? 'emerald' : 'blue'}`}>{up.status}</span>
                        {up.note && <p className="timeline-note">"{up.note}"</p>}
                        {up.photoUrl && <img className="timeline-photo" src={up.photoUrl} alt="Update photo" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-text">No worker feedback or progress updates posted yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
