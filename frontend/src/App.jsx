import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Camera, Check,
  ChevronDown, CircleAlert, ClipboardList, Clock3, Crosshair, Droplets,
  HardHat, KeyRound, LocateFixed, LogOut, MapPin, Menu, Plus, Power, Search,
  ShieldCheck, Trash2, TrafficCone, Upload, UserCog, Users, X, Zap,
} from 'lucide-react'
import './App.css'

const roles = {
  citizen: { label: 'Citizen', title: 'Your neighborhood, heard.', icon: MapPin, color: 'mint' },
  officer: { label: 'Municipal officer', title: 'Make every report count.', icon: ShieldCheck, color: 'gold' },
  worker: { label: 'Field worker', title: 'Small fixes. Big difference.', icon: HardHat, color: 'coral' },
  admin: { label: 'Administrator', title: 'Team access, under control.', icon: ShieldCheck, color: 'gold' },
}

const initialIssues = [
  { id: 'SNF-2841', title: 'Water main leaking', type: 'Water', street: '8th Ave & W 14th St', status: 'In progress', date: 'Today, 9:42 AM', lat: 40.738, lng: -73.999, color: 'blue', reporter: 'You' },
  { id: 'SNF-2838', title: 'Missed waste pickup', type: 'Sanitation', street: 'Bleecker St, near Grove', status: 'Assigned', date: 'Today, 8:16 AM', lat: 40.733, lng: -74.002, color: 'orange', reporter: 'Maya R.' },
  { id: 'SNF-2832', title: 'Streetlight out', type: 'Lighting', street: 'W 10th St & Hudson St', status: 'Verified', date: 'Yesterday', lat: 40.734, lng: -74.009, color: 'yellow', reporter: 'Jon B.' },
  { id: 'SNF-2824', title: 'Pothole on bike lane', type: 'Roads', street: 'Hudson St, at W 12th', status: 'Resolved', date: 'Yesterday', lat: 40.737, lng: -74.006, color: 'green', reporter: 'Sam K.' },
]

const categories = [
  { name: 'Roads', icon: TrafficCone },
  { name: 'Sanitation', icon: Trash2 },
  { name: 'Water', icon: Droplets },
  { name: 'Lighting', icon: Zap },
  { name: 'Other', icon: CircleAlert },
]

function markerIcon(color) {
  return L.divIcon({ className: 'issue-marker-wrap', html: `<span class="issue-marker ${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] })
}

function App() {
  const initialPath = window.location.pathname.split('/').filter(Boolean)
  let savedUser = null
  try { savedUser = JSON.parse(localStorage.getItem('snapnfix-user') || 'null') } catch { savedUser = null }
  const initialRole = roles[initialPath[1]] ? initialPath[1] : initialPath[0] === 'admin' ? 'admin' : 'citizen'
  const initialScreen = savedUser?.mustChangePassword ? 'password-change' : initialPath[0] === 'login' ? 'login' : initialPath[0] === 'admin' && savedUser?.role === 'admin' ? 'admin' : initialPath[0] === 'admin' ? 'login' : 'dashboard'
  const [screen, setScreen] = useState(initialScreen)
  const [role, setRole] = useState(initialRole)
  const [authMode, setAuthMode] = useState('login')
  const [activeFilter, setActiveFilter] = useState('All reports')
  const [issues, setIssues] = useState(initialIssues)
  const [showReport, setShowReport] = useState(false)
  const [showMobileNav, setShowMobileNav] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [preview, setPreview] = useState('')
  const [reportCoords, setReportCoords] = useState(null)
  const [busy, setBusy] = useState(false)
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('snapnfix-user') || 'null') } catch { return null }
  })
  const [workflow, setWorkflow] = useState(null)
  const [workers, setWorkers] = useState([])
  const [actionBusy, setActionBusy] = useState(false)
  const [staff, setStaff] = useState([])
  const [staffModal, setStaffModal] = useState(null)
  const [metrics, setMetrics] = useState({ reportsThisWeek: 0, awaitingAction: 0, resolvedPercent: 0 })
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

  const loadAccountData = async (token = localStorage.getItem('snapnfix-token')) => {
    if (!token || account?.mustChangePassword) return
    const issueResponse = await fetch(`${apiUrl}/api/issues`, { headers: { Authorization: `Bearer ${token}` } })
    if (issueResponse.status === 401) {
      localStorage.removeItem('snapnfix-token')
      localStorage.removeItem('snapnfix-user')
      setAccount(null)
      go('login', role)
      return
    }
    if (issueResponse.ok) {
      const issueData = await issueResponse.json()
      setIssues(issueData.issues.map((issue) => ({
        dbId: issue._id, id: issue.ticketId, title: issue.title, type: issue.category, street: issue.location,
        status: issue.status, date: new Date(issue.createdAt).toLocaleDateString(), lat: issue.coordinates?.lat,
        lng: issue.coordinates?.lng, color: issue.status === 'Resolved' ? 'green' : issue.status === 'Verified' ? 'yellow' : issue.status === 'In progress' ? 'blue' : 'orange',
        reporter: issue.reporter?.name || 'Community', assignedTo: issue.assignedTo?.name,
      })))
    }
    await refreshMetrics(token)
    if (account?.role === 'admin') {
      const staffResponse = await fetch(`${apiUrl}/api/admin/staff`, { headers: { Authorization: `Bearer ${token}` } })
      if (staffResponse.ok) {
        const staffResult = await staffResponse.json()
        setStaff(staffResult.staff)
      }
    }
  }

  useEffect(() => {
    if (account?.id && !account.mustChangePassword) loadAccountData().catch((error) => setNotice(error.message))
  }, [account?.id, account?.mustChangePassword])

  const refreshMetrics = async (token = localStorage.getItem('snapnfix-token')) => {
    if (!token) return
    try {
      const response = await fetch(`${apiUrl}/api/issues/metrics`, { headers: { Authorization: `Bearer ${token}` } })
      if (response.ok) setMetrics(await response.json())
    } catch { /* dashboard can continue without metrics */ }
  }

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
      setNotice('Password changed successfully.')
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
      if (role === 'admin') go('admin', role)
      else go('dashboard', role)
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
      setNotice(isNew ? 'Staff account created. Share the temporary password securely.' : staffModal.mode === 'reset' ? 'Password reset. Share the new temporary password securely.' : 'Staff account updated.')
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
      setNotice(`${member.name}'s account is ${result.staff.isActive ? 'active' : 'deactivated'}.`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setActionBusy(false)
    }
  }

  const submitIssue = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const newIssue = {
      id: `SNF-${Math.floor(2800 + Math.random() * 1200)}`,
      title: data.get('title'), type: data.get('category'), street: data.get('location') || 'Location pin dropped',
      status: 'Submitted', date: 'Just now', lat: reportCoords?.lat, lng: reportCoords?.lng,
      color: 'orange', reporter: 'You',
    }
    const token = localStorage.getItem('snapnfix-token')
    try {
      if (token) {
        const response = await fetch(`${apiUrl}/api/issues`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: data,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Report could not be submitted')
        newIssue.id = result.issue.ticketId
      }
      setIssues((current) => [newIssue, ...current])
      await refreshMetrics(token)
      setShowReport(false)
      setPreview('')
      setNotice('Your report is on the map. We’ll keep you updated.')
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
        else setNotice(result.message || 'Unable to load field workers.')
      } catch { setNotice('Connect to the API to load the field worker directory.') }
    }
  }

  const verifyIssue = async (issue) => {
    const token = localStorage.getItem('snapnfix-token')
    if (!token || !issue.dbId) {
      setIssues((current) => current.map((item) => item.id === issue.id ? { ...item, status: 'Verified', color: 'yellow' } : item))
      setNotice(`${issue.id} marked as verified in this demo.`)
      return
    }
    const response = await fetch(`${apiUrl}/api/issues/${issue.dbId}/verify`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const result = await response.json()
    if (!response.ok) return setNotice(result.message || 'Unable to verify this report.')
    setIssues((current) => current.map((item) => item.id === issue.id ? { ...item, status: 'Verified', color: 'yellow' } : item))
    await refreshMetrics(token)
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
      if (token && issue.dbId) {
        const isAssignment = workflow.type === 'assign'
        const response = await fetch(`${apiUrl}/api/issues/${issue.dbId}/${workflow.type}`, {
          method: 'PATCH', headers: { Authorization: `Bearer ${token}`, ...(isAssignment ? { 'Content-Type': 'application/json' } : {}) },
          body: isAssignment ? JSON.stringify({ workerId: data.get('workerId') }) : data,
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.message || 'Unable to update this report.')
      }
      const status = workflow.type === 'assign' ? 'Assigned' : data.get('status')
      setIssues((current) => current.map((item) => item.id === issue.id ? { ...item, status, color: status === 'Resolved' ? 'green' : 'blue' } : item))
      await refreshMetrics(token)
      setWorkflow(null)
      setPreview('')
      setNotice(`${issue.id} updated to ${status.toLowerCase()}.`)
    } catch (error) {
      setNotice(error.message)
    } finally {
      setActionBusy(false)
    }
  }

  const mapIssue = issues.find((issue) => Number.isFinite(issue.lat) && Number.isFinite(issue.lng))
  const mapCenter = mapIssue ? [mapIssue.lat, mapIssue.lng] : [20.5937, 78.9629]

  const filteredIssues = issues.filter((issue) => {
    const matchesFilter = activeFilter === 'All reports' || issue.status === activeFilter
    const matchesSearch = `${issue.title} ${issue.street} ${issue.id}`.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  if (screen === 'password-change' && passwordChangeRequired) {
    return (
      <main className="login-shell">
        <section className="login-panel gold">
          <div className="login-aside"><div className="eyebrow"><span className="eyebrow-dot" /> ACCOUNT SECURITY</div><KeyRound size={30} strokeWidth={1.7} /><h1>Set your personal password.</h1><p>This temporary password must be replaced before you can continue.</p></div>
          <div className="login-form-wrap"><span className="form-kicker">FIRST SIGN-IN</span><h2>Choose a new password</h2><p className="form-intro">Use at least 12 characters, including a letter and a number.</p>
            {notice && <div className="notice-banner" role="status">{notice}</div>}
            <form className="login-form" onSubmit={changePassword}><label>Current temporary password<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>New password<input name="newPassword" type="password" required minLength={12} autoComplete="new-password" /></label><button className="button button-dark" type="submit" disabled={actionBusy}>{actionBusy ? 'Saving…' : 'Set new password'} <ArrowRight size={16} /></button></form>
          </div>
        </section>
      </main>
    )
  }

  if (screen === 'login') {
    const RoleIcon = roles[role].icon
    return (
      <main className="login-shell">
        <a className="brand login-brand" href="/" onClick={(event) => { event.preventDefault(); go('dashboard') }}><span className="brand-mark"><MapPin size={18} /></span> snap<span>n</span>fix</a>
        <section className={`login-panel ${roles[role].color}`}>
          <div className="login-aside">
            <div className="eyebrow"><span className="eyebrow-dot" /> COMMUNITY RESPONSE NETWORK</div>
            <RoleIcon size={30} strokeWidth={1.7} />
            <h1>{roles[role].title}</h1>
            <p>Good streets happen when neighbors and city teams work together.</p>
            <div className="login-aside-foot"><span>01</span><span className="aside-rule" /><span>COMMUNITY RESPONSE NETWORK</span></div>
          </div>
          <div className="login-form-wrap">
            <button className="back-link" onClick={() => go('dashboard')}><ArrowLeft size={16} /> Back to map</button>
            <p className="form-kicker">SECURE ACCESS</p>
            <h2>{authMode === 'register' ? 'Create your citizen account' : role === 'citizen' ? 'Welcome back' : `Sign in as ${roles[role].label.toLowerCase()}`}</h2>
            <p className="form-subtitle">Use your Snap N Fix account to continue.</p>
            <form onSubmit={signIn} className="auth-form">
              {authMode === 'register' && <label>Full name<input name="name" type="text" placeholder="Your name" autoComplete="name" required maxLength="80" /></label>}
              <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
              <label>Password<input name="password" type="password" placeholder="Enter your password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} required minLength={authMode === 'register' ? 8 : 6} /></label>
              {authMode === 'login' && <div className="form-options"><label className="check-label"><input type="checkbox" /> Remember me</label><button type="button" className="text-button" onClick={() => setNotice('Password reset is available once email delivery is configured.')}>Forgot password?</button></div>}
              <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : authMode === 'register' ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
            </form>
            {authMode === 'login' && role !== 'admin' && <button className="demo-link" onClick={() => { localStorage.removeItem('snapnfix-token'); localStorage.removeItem('snapnfix-user'); setAccount(null); go('dashboard', role) }}>Explore {roles[role].label.toLowerCase()} demo <ArrowUpRight size={14} /></button>}
            {notice && <p className="form-notice" role="status">{notice}</p>}
            <div className="role-switch"><span>Sign in to a different workspace</span><div>{Object.entries(roles).filter(([key]) => key !== role).map(([key, item]) => <button key={key} onClick={() => go('login', key)}>{item.label}<ArrowUpRight size={13} /></button>)}</div></div>
            {role === 'citizen' && <p className="signup-line">{authMode === 'register' ? 'Already registered?' : 'New to the neighborhood?'} <button onClick={() => { setAuthMode(authMode === 'register' ? 'login' : 'register'); setNotice('') }}>{authMode === 'register' ? 'Sign in' : 'Create an account'}</button></p>}
          </div>
        </section>
        <p className="login-footer">© 2026 SNAP N FIX <span>·</span> BUILT FOR BETTER BLOCKS</p>
      </main>
    )
  }

  if (screen === 'admin' && account?.role === 'admin') {
    const activeCount = staff.filter((member) => member.isActive).length
    const officerCount = staff.filter((member) => member.role === 'officer').length
    const workerCount = staff.filter((member) => member.role === 'worker').length
    const visibleStaff = staff.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(search.toLowerCase()))
    const modalMode = staffModal?.mode
    return (
      <main className="admin-shell">
        <header className="admin-topbar">
          <a className="brand" href="/admin" onClick={(event) => event.preventDefault()}><span className="brand-mark"><MapPin size={18} /></span> snap<span>n</span>fix <span className="admin-wordmark">ADMIN</span></a>
          <div className="admin-top-actions"><a href="/" onClick={(event) => { event.preventDefault(); go('dashboard', 'citizen') }}>Community map <ArrowUpRight size={14} /></a><span className="admin-avatar">{account.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><button className="admin-signout" onClick={() => { localStorage.removeItem('snapnfix-token'); localStorage.removeItem('snapnfix-user'); setAccount(null); go('login', 'admin') }}><LogOut size={15} /> Sign out</button></div>
        </header>
        <div className="admin-content">
          <div className="admin-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> STAFF ACCESS DIRECTORY</div><h1>People who keep the city moving.</h1><p>Create and manage municipal officer and field worker accounts.</p></div><button className="button button-dark" onClick={() => setStaffModal({ mode: 'create' })}><Plus size={17} /> Add staff member</button></div>
          {notice && <div className="notice-banner" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
          <section className="admin-stats"><div><Users size={18} /><span>Total staff</span><strong>{staff.length}</strong></div><div><ShieldCheck size={18} /><span>Municipal officers</span><strong>{officerCount}</strong></div><div><HardHat size={18} /><span>Field workers</span><strong>{workerCount}</strong></div><div><Check size={18} /><span>Active accounts</span><strong>{activeCount}</strong></div></section>
          <section className="staff-panel"><div className="staff-panel-heading"><div><h2>Staff accounts</h2><p>Email addresses and access status for municipal teams.</p></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff" /></label></div>
            <div className="staff-table-wrap"><table className="staff-table"><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleStaff.map((member) => <tr key={member.id}><td><span className="staff-name"><span className={`staff-avatar ${member.role}`}>{member.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><strong>{member.name}</strong></span></td><td>{member.email}</td><td><span className={`role-pill ${member.role}`}>{member.role === 'officer' ? 'Municipal officer' : 'Field worker'}</span></td><td><span className={`account-status ${member.isActive ? 'active' : 'inactive'}`}><i />{member.isActive ? 'Active' : 'Deactivated'}</span></td><td>{new Date(member.createdAt).toLocaleDateString()}</td><td><div className="staff-actions"><button title="Edit staff details" aria-label={`Edit ${member.name}`} onClick={() => setStaffModal({ mode: 'edit', member })}><UserCog size={15} /></button><button title="Reset password" aria-label={`Reset password for ${member.name}`} onClick={() => setStaffModal({ mode: 'reset', member })}><KeyRound size={15} /></button><button title={member.isActive ? 'Deactivate account' : 'Reactivate account'} aria-label={`${member.isActive ? 'Deactivate' : 'Reactivate'} ${member.name}`} disabled={actionBusy} onClick={() => toggleStaff(member)}><Power size={15} /></button></div></td></tr>)}</tbody></table>{visibleStaff.length === 0 && <div className="staff-empty">{staff.length ? 'No staff match your search.' : 'No staff accounts yet. Add your first officer or field worker.'}</div>}</div>
          </section>
          <p className="admin-security-note"><ShieldCheck size={15} /> Passwords are stored as secure hashes. You can set a temporary password or reset one, but existing passwords are never viewable.</p>
        </div>
        {staffModal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setStaffModal(null) }}><section className="report-modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="staff-modal-title"><div className="modal-top"><div><span className="form-kicker">ADMINISTRATOR</span><h2 id="staff-modal-title">{modalMode === 'create' ? 'Add staff member' : modalMode === 'reset' ? 'Reset password' : 'Edit staff details'}</h2></div><button className="icon-button" aria-label="Close" onClick={() => setStaffModal(null)}><X size={19} /></button></div><p className="modal-intro">{modalMode === 'create' ? 'Create a secure account for a municipal team member.' : modalMode === 'reset' ? `Set a new temporary password for ${staffModal.member.name}.` : `Update contact and role details for ${staffModal.member.name}.`}</p><form className="report-form" onSubmit={saveStaff}>{modalMode !== 'reset' && <><label>Full name<input name="name" defaultValue={staffModal.member?.name || ''} placeholder="Staff member name" required maxLength="80" /></label><label>Email address<input name="email" type="email" defaultValue={staffModal.member?.email || ''} placeholder="name@city.gov" required /></label><label>Workspace role<select name="role" defaultValue={staffModal.member?.role || 'officer'}><option value="officer">Municipal officer</option><option value="worker">Field worker</option></select></label></>}{modalMode === 'reset' && <label>Account email<input value={staffModal.member.email} readOnly /></label>}{modalMode !== 'edit' && <label>{modalMode === 'create' ? 'Temporary password' : 'New temporary password'}<input name="password" type="password" minLength="12" autoComplete="new-password" required placeholder="At least 12 characters" /></label>}<p className="temporary-password-note">Share temporary passwords with the staff member through a secure channel.</p><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setStaffModal(null)}>Cancel</button><button type="submit" className="button button-dark" disabled={actionBusy}>{actionBusy ? 'Saving…' : modalMode === 'create' ? 'Create account' : modalMode === 'reset' ? 'Reset password' : 'Save changes'}<Check size={16} /></button></div></form></section></div>}
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMobileNav ? 'nav-open' : ''}`}>
        <a className="brand" href="/" onClick={(event) => event.preventDefault()}><span className="brand-mark"><MapPin size={18} /></span> snap<span>n</span>fix</a>
        <div className="district-switch"><div className="district-avatar">S</div><div><strong>Community reports</strong><small>Location data from submitted reports</small></div><ChevronDown size={15} /></div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav">
          <button className="nav-item active"><MapPin size={17} /> Issue map <span className="nav-count">{issues.length}</span></button>
          <button className="nav-item" onClick={() => setActiveFilter('All reports')}><ClipboardList size={17} /> All reports <span className="nav-count">{issues.length}</span></button>
          {role !== 'citizen' && <button className="nav-item"><HardHat size={17} /> {role === 'officer' ? 'Assignments' : 'My work'}<span className="nav-count">{issues.filter((issue) => issue.status === (role === 'officer' ? 'Assigned' : 'In progress')).length}</span></button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="response-card"><div className="response-heading"><span className="live-dot" /> DISTRICT RESPONSE</div><div className="response-number">2.4 <span>days</span></div><p>Average time to resolve<br />this month</p><div className="response-trend"><ArrowDown size={13} /> 18% faster than last month</div></div>
          <button className="account-button" onClick={() => { if (account) { localStorage.removeItem('snapnfix-token'); localStorage.removeItem('snapnfix-user'); setAccount(null); go('dashboard', 'citizen') } else go('login', role) }}><div className="account-avatar">{account?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2) || (role === 'citizen' ? 'JR' : role === 'officer' ? 'MO' : 'FW')}</div><div><strong>{account?.name || (role === 'citizen' ? 'Jordan Rivera' : roles[role].label)}</strong><small>{account ? 'Sign out' : `${roles[role].label} account`}</small></div>{account ? <LogOut size={16} /> : <ArrowUpRight size={16} />}</button>
        </div>
      </aside>

      {showMobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setShowMobileNav(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumb">Community <span>/</span> <strong>Issue map</strong></div>
          <div className="topbar-actions"><span className="updated-label"><span className="live-dot" /> DATA FROM API</span><button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice('You’re all caught up.') }><Bell size={18} /><i /></button><button className="topbar-signin" onClick={() => go('login', role)}>Sign in <ArrowUpRight size={14} /></button></div>
        </header>
        <div className="page-content">
          <section className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> THE NEIGHBORHOOD, IN THE KNOW</div><h1>Make your block <em>better.</em></h1><p>Spot an issue? Report it. Follow every fix, from first look to done.</p></div><button className="button button-dark report-button" onClick={() => setShowReport(true)}><Plus size={18} /> Report an issue</button></section>
          {notice && <div className="notice-banner" role="status"><Check size={16} /> {notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
          <section className="stats-row" aria-label="Current report statistics"><div className="stat-item"><span className="stat-icon coral"><CircleAlert size={17} /></span><div><strong>{metrics.reportsThisWeek}</strong><span>Reports this week</span></div></div><div className="stat-item"><span className="stat-icon gold"><Clock3 size={17} /></span><div><strong>{metrics.awaitingAction}</strong><span>Awaiting action</span></div></div><div className="stat-item"><span className="stat-icon mint"><Check size={17} /></span><div><strong>{metrics.resolvedPercent}%</strong><span>Resolved this month</span></div></div></section>
          <section className="map-section"><div className="section-heading"><div><div className="section-title-line"><h2>Live issue map</h2><span className="issue-total">{issues.length} nearby</span></div><p>Reports loaded from the SnapNFix API.</p></div><button className="map-locate" title="Locate me"><LocateFixed size={16} /><span>My area</span></button></div>
            <div className="map-frame"><MapContainer center={mapCenter} zoom={15} zoomControl={false} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><ZoomControl position="bottomright" />{issues.filter((issue) => Number.isFinite(issue.lat) && Number.isFinite(issue.lng)).map((issue) => <Marker key={issue.id} position={[issue.lat, issue.lng]} icon={markerIcon(issue.color)}><div>{issue.title}</div></Marker>)}</MapContainer><div className="map-caption"><span className="map-live"><span className="live-dot" /> {account ? 'API DATA' : 'DEMO DATA'}</span><span><MapPin size={13} /> REPORT LOCATIONS</span></div><div className="map-legend"><span><i className="legend-dot open" /> Needs attention</span><span><i className="legend-dot progress" /> In progress</span><span><i className="legend-dot resolved" /> Resolved</span></div></div>
          </section>
          <section className="reports-section"><div className="reports-heading"><div><div className="section-title-line"><h2>Latest reports</h2><button className="subtle-link" onClick={() => setNotice('You’re viewing all reports in this district.')}>View all <ArrowRight size={14} /></button></div><p>See what your neighbors are flagging.</p></div><label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reports" /></label></div>
            <div className="filter-row">{['All reports', 'Submitted', 'In progress', 'Resolved'].map((filter) => <button key={filter} className={`filter-chip ${activeFilter === filter ? 'selected' : ''}`} onClick={() => setActiveFilter(filter)}>{filter}{filter === 'All reports' && <span>{issues.length}</span>}</button>)}</div>
            <div className="issue-list">{filteredIssues.map((issue) => <article className="issue-row" key={issue.id}><div className={`issue-category-icon ${issue.color}`}>{issue.type === 'Water' ? <Droplets size={18} /> : issue.type === 'Sanitation' ? <Trash2 size={18} /> : issue.type === 'Lighting' ? <Zap size={18} /> : <TrafficCone size={18} />}</div><div className="issue-main"><div className="issue-title-line"><h3>{issue.title}</h3><span className={`status-tag ${issue.status.toLowerCase().replace(' ', '-')}`}><i />{issue.status}</span></div><div className="issue-meta"><span>{issue.street}</span><b>·</b><span>{issue.id}</span></div></div><div className="issue-date">{issue.date}<span>Reported by {issue.reporter}</span></div>{role === 'officer' && <div className="workflow-buttons">{issue.status === 'Submitted' && <button onClick={() => verifyIssue(issue)}>Verify</button>}<button onClick={() => openWorkflow('assign', issue)}>Assign</button></div>}{role === 'worker' && <button className="workflow-button" onClick={() => openWorkflow('progress', issue)}>Update</button>}<button className="issue-arrow" aria-label={`View ${issue.title}`} onClick={() => setNotice(`${issue.id} · ${issue.status} · Last updated ${issue.date}.`)}><ArrowUpRight size={17} /></button></article>)}{filteredIssues.length === 0 && <div className="empty-state">No reports match your search.</div>}</div>
          </section>
          <footer className="page-footer"><span>SNAP N FIX <b>·</b> WEST VILLAGE, NYC</span><button onClick={() => go('login', 'officer')}>Municipal portal <ArrowUpRight size={13} /></button></footer>
        </div>
      </main>

      {(showReport || workflow) && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowReport(false); setWorkflow(null); setPreview('') } }}>{showReport ? <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><div className="modal-top"><div><span className="form-kicker">HELP YOUR BLOCK</span><h2 id="report-title">Report an issue</h2></div><button className="icon-button" aria-label="Close" onClick={() => { setShowReport(false); setPreview('') }}><X size={19} /></button></div><p className="modal-intro">A clear report helps the right crew get there sooner.</p><form className="report-form" onSubmit={submitIssue}><label>What needs attention?<input name="title" placeholder="e.g. Pothole near the crosswalk" required maxLength="100" /></label><label>Describe the issue<textarea name="description" rows="2" placeholder="What happened, and how is it affecting the block?" maxLength="2000" /></label><div className="category-select"><span>Choose a category</span><div className="category-grid">{categories.map(({ name, icon: Icon }) => <label key={name} className="category-option"><input type="radio" name="category" value={name} defaultChecked={name === 'Roads'} /><span><Icon size={17} />{name}</span></label>)}</div></div><label>Where is it?<span className="location-input"><MapPin size={16} /><input name="location" placeholder="Street address or nearest intersection" required /><button type="button" title="Use current location" onClick={() => { if (!navigator.geolocation) return setNotice('Location access is not supported in this browser.'); navigator.geolocation.getCurrentPosition(({ coords }) => { setReportCoords({ lat: coords.latitude, lng: coords.longitude }); setNotice('Precise location added to your report.') }, () => setNotice('Location permission was not granted.')) }}><Crosshair size={16} /></button></span><input type="hidden" name="lat" value={reportCoords?.lat || ''} /><input type="hidden" name="lng" value={reportCoords?.lng || ''} /></label><label className="upload-zone">{preview ? <img className="photo-preview" src={preview} alt="Issue preview" /> : <span className="upload-icon"><Camera size={19} /></span>}<span><strong>{preview ? 'Photo attached' : 'Add a photo'}</strong><small>{preview ? 'Click to choose a different photo' : 'A photo helps crews understand the issue'}</small></span><Upload size={17} /><input type="file" accept="image/*" name="photo" required onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)) }} /></label><div className="modal-actions"><button type="button" className="button button-outline" onClick={() => { setShowReport(false); setPreview('') }}>Cancel</button><button type="submit" className="button button-dark"><Plus size={17} /> Submit report</button></div></form></section> : <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title"><div className="modal-top"><div><span className="form-kicker">{workflow.type === 'assign' ? 'MUNICIPAL WORKSPACE' : 'FIELD UPDATE'}</span><h2 id="workflow-title">{workflow.type === 'assign' ? 'Assign a crew' : 'Update report'}</h2></div><button className="icon-button" aria-label="Close" onClick={() => { setWorkflow(null); setPreview('') }}><X size={19} /></button></div><p className="modal-intro">{workflow.issue.id} · {workflow.issue.title}</p><form className="report-form" onSubmit={submitWorkflow}>{workflow.type === 'assign' ? <label>Field worker<select name="workerId" required defaultValue=""><option value="" disabled>Select a worker</option>{workers.length ? workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>) : <option value="" disabled>No active workers available</option>}</select></label> : <><label>New status<select name="status" defaultValue="In progress"><option>In progress</option><option>Resolved</option></select></label><label>Work note<textarea name="note" rows="3" placeholder="Add a short progress update" /></label><label className="upload-zone">{preview ? <img className="photo-preview" src={preview} alt="Proof preview" /> : <span className="upload-icon"><Camera size={19} /></span>}<span><strong>{preview ? 'Proof photo attached' : 'Add proof photo'}</strong><small>Required when marking the issue resolved</small></span><Upload size={17} /><input type="file" accept="image/*" name="photo" required={workflow.issue.status !== 'Resolved'} onChange={(event) => { const file = event.target.files?.[0]; if (file) setPreview(URL.createObjectURL(file)) }} /></label></>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setWorkflow(null)}>Cancel</button><button type="submit" className="button button-dark" disabled={actionBusy}>{actionBusy ? 'Saving…' : workflow.type === 'assign' ? 'Assign report' : 'Save update'}<ArrowRight size={16} /></button></div></form></section>}</div>}
    </div>
  )
}

export default App
