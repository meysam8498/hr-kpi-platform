/**
 * API Client — no auth, direct to FastAPI backend.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface FetchOptions extends RequestInit {
  json?: unknown
}

class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function request<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { json, ...fetchOptions } = options
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  }
  if (json) {
    headers['Content-Type'] = 'application/json'
    fetchOptions.body = JSON.stringify(json)
  }
  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers })
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }))
    let detail = errorBody.detail || 'Request failed'
    // FastAPI validation errors return detail as an array of objects
    if (Array.isArray(detail)) {
      detail = detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', ')
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

// ─── Types ───
export interface Team {
  id: number
  name: string
  description: string | null
  created_at: string
  member_count: number
}

export interface Employee {
  id: number
  employee_code: string
  first_name: string
  last_name: string
  position: string
  team_id: number
  hire_date: string
  phone: string | null
  is_archived: boolean
  created_at: string
  team_name: string | null
}

export interface KPICriterion {
  id: number
  name: string
  description: string | null
  category: string
  min_score: number
  max_score: number
  is_active: boolean
  created_at: string
}

export interface TeamKPIConfig {
  id: number
  team_id: number
  criterion_id: number
  criterion_name: string | null
  criterion_category: string | null
  weight: number
  is_active: boolean
  created_at: string
}

export interface ReportingPeriod {
  id: number
  name: string
  period_type: string
  start_date: string
  end_date: string
  is_active: boolean
  is_archived: boolean
  created_at: string
}

export interface KPIEntry {
  id: number
  employee_id: number
  criterion_id: number
  period_id: number
  score: number
  comment: string | null
  criterion_name: string | null
  employee_name: string | null
  period_name: string | null
  created_at: string
}

export interface KPIResult {
  id: number
  employee_id: number
  period_id: number
  final_score: number
  breakdown: Record<string, unknown> | null
  calculated_at: string
  employee_name: string | null
  employee_code: string | null
  team_name: string | null
  period_name: string | null
}

// ─── API Functions ───
export const teamsApi = {
  list: () => request<Team[]>('/api/teams/'),
  get: (id: number) => request<Team>(`/api/teams/${id}`),
  create: (data: { name: string; description?: string }) =>
    request<Team>('/api/teams/', { method: 'POST', json: data }),
  update: (id: number, data: { name?: string; description?: string }) =>
    request<Team>(`/api/teams/${id}`, { method: 'PUT', json: data }),
  delete: (id: number) => request(`/api/teams/${id}`, { method: 'DELETE' }),
}

export const employeesApi = {
  list: (teamId?: number) => {
    const params = teamId ? `?team_id=${teamId}` : ''
    return request<Employee[]>(`/api/employees/${params}`)
  },
  listArchived: (teamId?: number) => {
    const params = teamId ? `?archived=true&team_id=${teamId}` : '?archived=true'
    return request<Employee[]>(`/api/employees/${params}`)
  },
  listAll: (teamId?: number) => {
    const params = teamId ? `?team_id=${teamId}` : ''
    return request<Employee[]>(`/api/employees/all${params}`)
  },
  create: (data: {
    employee_code: string; first_name: string; last_name: string;
    position: string; team_id: number; hire_date: string; phone?: string
  }) => request<Employee>('/api/employees/', { method: 'POST', json: data }),
  update: (id: number, data: Partial<Employee>) =>
    request<Employee>(`/api/employees/${id}`, { method: 'PUT', json: data }),
  transfer: (id: number, newTeamId: number) =>
    request<Employee>(`/api/employees/${id}/transfer?new_team_id=${newTeamId}`, { method: 'PUT' }),
  archive: (id: number) => request<Employee>(`/api/employees/${id}/archive`, { method: 'PUT' }),
  unarchive: (id: number) => request<Employee>(`/api/employees/${id}/unarchive`, { method: 'PUT' }),
  delete: (id: number) => request(`/api/employees/${id}`, { method: 'DELETE' }),
  importJson: (items: { employee_code: string; first_name: string; last_name: string; position: string; team_name: string; hire_date: string; phone?: string }[]) =>
    request<{ created: number; skipped: { row: number; employee_code: string; reason: string }[]; errors: { row: number; reason: string }[] }>('/api/employees/import-json-by-name', { method: 'POST', json: items }),
  importExcel: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/employees/import-excel`, { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'خطا در وارد کردن فایل' }))
      throw new Error(body.detail || 'خطا در وارد کردن فایل')
    }
    return res.json()
  },
}

export const kpiApi = {
  listCriteria: (category?: string) => {
    const params = category ? `?category=${category}` : ''
    return request<KPICriterion[]>(`/api/kpi/criteria${params}`)
  },
  createCriteria: (data: { name: string; description?: string; category: string }) =>
    request<KPICriterion>('/api/kpi/criteria', { method: 'POST', json: data }),
  deleteCriteria: (id: number) =>
    request(`/api/kpi/criteria/${id}`, { method: 'DELETE' }),

  teamConfig: (teamId: number) => request<TeamKPIConfig[]>(`/api/kpi/teams/${teamId}/config`),
  addTeamConfig: (teamId: number, data: { criterion_id: number; weight: number }) =>
    request<TeamKPIConfig>(`/api/kpi/teams/${teamId}/config`, { method: 'POST', json: data }),
  removeTeamConfig: (teamId: number, configId: number) =>
    request(`/api/kpi/teams/${teamId}/config/${configId}`, { method: 'DELETE' }),

  listPeriods: () => request<ReportingPeriod[]>('/api/kpi/periods'),
  createPeriod: (data: { name: string; period_type: string; start_date: string; end_date: string }) =>
    request<ReportingPeriod>('/api/kpi/periods', { method: 'POST', json: data }),

  batchScore: (employeeId: number, periodId: number, scores: { criterion_id: number; score: number; comment?: string }[]) =>
    request(`/api/kpi/entries/batch?employee_id=${employeeId}&period_id=${periodId}`, { method: 'POST', json: scores }),
  listEntries: (employeeId?: number, periodId?: number) => {
    const params = new URLSearchParams()
    if (employeeId) params.set('employee_id', String(employeeId))
    if (periodId) params.set('period_id', String(periodId))
    const qs = params.toString()
    return request<KPIEntry[]>(`/api/kpi/entries${qs ? '?' + qs : ''}`)
  },

  calculateEmployee: (empId: number, periodId: number) =>
    request<KPIResult>(`/api/kpi/calculate/${empId}/${periodId}`, { method: 'POST' }),
  calculateTeam: (teamId: number, periodId: number) =>
    request<{ results: { employee_id: number; final_score: number }[] }>(`/api/kpi/calculate/team/${teamId}/${periodId}`, { method: 'POST' }),
  calculateCompany: (periodId: number) =>
    request(`/api/kpi/calculate/company/${periodId}`, { method: 'POST' }),

  employeeResults: (empId: number) => request<KPIResult[]>(`/api/kpi/results/${empId}`),
  teamReport: (teamId: number, periodId: number) =>
    request<Record<string, unknown>>(`/api/kpi/reports/team/${teamId}/${periodId}`),
  companyReport: (periodId: number) =>
    request<Record<string, unknown>>(`/api/kpi/reports/company/${periodId}`),

  exportExcel: (teamId: number, periodId: number) => {
    return `${API_BASE}/api/kpi/export/${teamId}/${periodId}`
  },
  importExcel: async (teamId: number, periodId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/kpi/import/${teamId}/${periodId}`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error('Import failed')
    return res.json()
  },
  changeActivePeriod: (periodId: number) =>
    request(`/api/kpi/periods/${periodId}`, { method: 'PUT', json: { is_active: true } }),
  autoArchive: () =>
    request<{ message: string; archived_count: number }>('/api/kpi/periods/auto-archive', { method: 'POST' }),

  getTeamBlend: (teamId: number) =>
    request<{ team_id: number; team_name: string; base_weight: number; peer_weight: number; goal_weight: number; updated_at: string }>(`/api/kpi/teams/${teamId}/blend`),
  setTeamBlend: (teamId: number, data: { base_weight?: number; peer_weight?: number; goal_weight?: number }) =>
    request<{ team_id: number; team_name: string; base_weight: number; peer_weight: number; goal_weight: number; updated_at: string }>(`/api/kpi/teams/${teamId}/blend`, { method: 'PUT', json: data }),
}

// ─── PIP API ───
export interface PIPData {
  id: number
  employee_id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  target_score: number
  status: string
  notes: string | null
  created_at: string
  employee_name: string | null
  employee_code: string | null
  team_name: string | null
  latest_score: number | null
}

export const pipsApi = {
  list: (employeeId?: number) => {
    const params = employeeId ? `?employee_id=${employeeId}` : ''
    return request<PIPData[]>(`/api/pips${params}`)
  },
  create: (data: { employee_id: number; title: string; description?: string; start_date: string; end_date: string; target_score?: number }) =>
    request<PIPData>('/api/pips', { method: 'POST', json: data }),
  update: (id: number, data: { status?: string; notes?: string; target_score?: number }) =>
    request<PIPData>(`/api/pips/${id}`, { method: 'PUT', json: data }),
  delete: (id: number) => request(`/api/pips/${id}`, { method: 'DELETE' }),
  checkAuto: () => request<{ created: number; message: string }>('/api/pips/check-auto', { method: 'POST' }),
}

// ─── Self-Evaluation API ───
export interface SelfEvaluation {
  id: number
  employee_id: number
  period_id: number
  self_score: number
  strengths: string | null
  improvements: string | null
  created_at: string
  employee_name: string | null
  period_name: string | null
}

export const selfEvalApi = {
  list: (employeeId?: number, periodId?: number) => {
    const params = new URLSearchParams()
    if (employeeId) params.set('employee_id', String(employeeId))
    if (periodId) params.set('period_id', String(periodId))
    const qs = params.toString()
    return request<SelfEvaluation[]>(`/api/self-evaluations${qs ? '?' + qs : ''}`)
  },
  create: (data: { employee_id: number; period_id: number; self_score: number; strengths?: string; improvements?: string }) =>
    request<SelfEvaluation>('/api/self-evaluations', { method: 'POST', json: data }),
  update: (id: number, data: { self_score?: number; strengths?: string; improvements?: string }) =>
    request<SelfEvaluation>(`/api/self-evaluations/${id}`, { method: 'PUT', json: data }),
  delete: (id: number) => request(`/api/self-evaluations/${id}`, { method: 'DELETE' }),
}

// ─── Custom Report API ───
export const customReportApi = {
  generate: (data: {
    team_id?: number; employee_ids?: number[]; period_ids?: number[];
    criteria_ids?: number[]; min_score?: number; max_score?: number
  }) => request<Record<string, unknown>>('/api/reports/custom', { method: 'POST', json: data }),
}

// ─── HR Analytics API ───
export interface HRTeamStat {
  team_id: number
  team_name: string
  active: number
  archived: number
}

export interface HRPerformer {
  employee_id: number
  employee_name: string
  employee_code: string
  team_id: number | null
  team_name: string
  score: number
}

export interface HRPeriodPayload {
  id: number
  name: string
  avg_score: number
  scored_count: number
  bands: { excellent: number; good: number; average: number; poor: number }
  team_ranking: { team_id: number; team_name: string; avg: number; count: number }[]
  top: HRPerformer[]
  bottom: HRPerformer[]
}

export interface HRImprovement {
  previous_period_id: number
  previous_period_name: string
  previous_avg: number
  delta: number
  improved: number
  declined: number
  stable: number
  comparable: number
  improved_pct: number
}

export interface HRAnalytics {
  workforce: {
    active_count: number
    archived_count: number
    total_count: number
    attrition_rate: number
    new_hires: number
    experienced: number
    per_team: HRTeamStat[]
  }
  periods: { id: number; name: string; is_active: boolean; is_archived: boolean }[]
  selected_period: HRPeriodPayload | null
  trend: { period_id: number; name: string; avg: number; count: number }[]
  improvement: HRImprovement | null
  absences: {
    total_absence_days: number
    absence_rate: number
    period: { from: string; to: string }
    per_team: { team_id: number; team_name: string; absence_days: number }[]
  }
  self_gap: {
    avg_self_score: number
    avg_manager_score: number
    avg_gap: number
    count: number
    per_employee: { employee_id: number; employee_name: string; self_score: number; manager_score: number; gap: number }[]
  } | null
  decline_alerts: {
    employee_id: number
    employee_name: string
    employee_code: string
    team_name: string
    latest_score: number
    scores: number[]
    periods: string[]
  }[]
  goals_achievement: {
    total_goals: number
    completed: number
    completion_rate: number
    avg_achievement: number
  } | null
}

export const hrApi = {
  analytics: (periodId?: number) => {
    const params = periodId ? `?period_id=${periodId}` : ''
    return request<HRAnalytics>(`/api/hr/analytics${params}`)
  },
}

// ─── Absences API ───
export interface Absence {
  id: number
  employee_id: number
  absence_date: string
  reason: string | null
  created_at: string
  employee_name: string | null
  employee_code: string | null
  team_name: string | null
}

export interface AbsenceSummary {
  from_date: string
  to_date: string
  workdays: number
  total_absence_days: number
  absence_rate: number
  per_employee: { employee_id: number; employee_name: string; employee_code: string; team_id: number; team_name: string | null; absence_days: number }[]
  per_team: { team_id: number; team_name: string | null; absence_days: number; members: number }[]
}

export const absencesApi = {
  list: (employeeId?: number) => {
    const params = employeeId ? `?employee_id=${employeeId}` : ''
    return request<Absence[]>(`/api/absences/${params}`)
  },
  summary: () => request<AbsenceSummary>('/api/absences/summary'),
  create: (data: { employee_id: number; absence_date: string; reason?: string }) =>
    request<Absence>('/api/absences/', { method: 'POST', json: data }),
  delete: (id: number) => request(`/api/absences/${id}`, { method: 'DELETE' }),
}

// ─── Peer Reviews API ───
export interface PeerReview {
  id: number
  reviewer_id: number
  reviewee_id: number
  period_id: number
  teamwork_score: number
  communication_score: number
  reliability_score: number
  comment: string | null
  created_at: string
  reviewer_name: string | null
  reviewee_name: string | null
  period_name: string | null
  avg_score: number
}

export const peerReviewsApi = {
  list: (periodId?: number, revieweeId?: number) => {
    const params = new URLSearchParams()
    if (periodId) params.set('period_id', String(periodId))
    if (revieweeId) params.set('reviewee_id', String(revieweeId))
    const qs = params.toString()
    return request<PeerReview[]>(`/api/peer-reviews/${qs ? '?' + qs : ''}`)
  },
  create: (data: { reviewer_id: number; reviewee_id: number; period_id: number; teamwork_score: number; communication_score: number; reliability_score: number; comment?: string }) =>
    request<PeerReview>('/api/peer-reviews/', { method: 'POST', json: data }),
  update: (id: number, data: { teamwork_score?: number; communication_score?: number; reliability_score?: number; comment?: string }) =>
    request<PeerReview>(`/api/peer-reviews/${id}`, { method: 'PUT', json: data }),
  delete: (id: number) => request(`/api/peer-reviews/${id}`, { method: 'DELETE' }),
  summary: (revieweeId: number, periodId: number) =>
    request<{ reviewee_id: number; period_id: number; review_count: number; avg_score: number; teamwork_avg: number; communication_avg: number; reliability_avg: number }>(`/api/peer-reviews/summary/${revieweeId}/${periodId}`),
}

// ─── Goals API ───
export interface Goal {
  id: number
  employee_id: number
  period_id: number
  title: string
  description: string | null
  target_value: number
  current_value: number
  unit: string | null
  status: string
  created_at: string
  employee_name: string | null
  period_name: string | null
  achievement_pct: number
}

export const goalsApi = {
  list: (employeeId?: number, periodId?: number) => {
    const params = new URLSearchParams()
    if (employeeId) params.set('employee_id', String(employeeId))
    if (periodId) params.set('period_id', String(periodId))
    const qs = params.toString()
    return request<Goal[]>(`/api/goals/${qs ? '?' + qs : ''}`)
  },
  create: (data: { employee_id: number; period_id: number; title: string; description?: string; target_value: number; unit?: string }) =>
    request<Goal>('/api/goals/', { method: 'POST', json: data }),
  update: (id: number, data: { title?: string; description?: string; target_value?: number; current_value?: number; unit?: string; status?: string }) =>
    request<Goal>(`/api/goals/${id}`, { method: 'PUT', json: data }),
  delete: (id: number) => request(`/api/goals/${id}`, { method: 'DELETE' }),
}

// ─── Notifications API ───
export interface NotificationItem {
  id: number
  title: string
  message: string
  type: string
  is_read: boolean
  link: string | null
  created_at: string
}

export const notificationsApi = {
  list: (unreadOnly = false) => {
    const params = unreadOnly ? '?unread_only=true' : ''
    return request<NotificationItem[]>(`/api/notifications/${params}`)
  },
  unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  markRead: (id: number) => request(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request('/api/notifications/read-all', { method: 'PUT' }),
  delete: (id: number) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
  checkDeadlines: () => request<{ created: number; message: string }>('/api/notifications/check-deadlines', { method: 'POST' }),
  remindManagers: (periodId: number) =>
    request<{ created: number; missing: string[]; message: string }>(
      `/api/notifications/remind-managers/${periodId}`, { method: 'POST' }
    ),
}

// ─── Audit Logs API ───
export interface AuditLogItem {
  id: number
  action: string
  entity_type: string
  entity_id: number | null
  description: string
  created_at: string
}

export const auditApi = {
  list: (entityType?: string, limit = 200) => {
    const params = new URLSearchParams()
    if (entityType) params.set('entity_type', entityType)
    params.set('limit', String(limit))
    return request<AuditLogItem[]>(`/api/audit-logs/?${params.toString()}`)
  },
}

// ─── Backup API ───
export const backupApi = {
  info: () => request<{ database_path: string; size_bytes: number; size_mb: number; last_modified: string }>('/api/backup/info'),
  downloadUrl: () => `${API_BASE}/api/backup/download`,
  restore: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_BASE}/api/backup/restore`, { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: 'خطا در بازیابی' }))
      throw new Error(body.detail || 'خطا در بازیابی')
    }
    return res.json()
  },
}
