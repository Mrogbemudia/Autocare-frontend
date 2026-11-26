import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatDateTime } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'
import { StartCallButton } from '../components/CallCenter.jsx'

export default function InterviewQueue() {
  const queryClient = useQueryClient()
  const [times, setTimes] = useState({})
  const queue = useQuery({ queryKey: ['interviews', 'queue'], queryFn: api.interviews.queue, refetchInterval: 15_000 })
  const schedule = useMutation({
    mutationFn: ({id,scheduledAt}) => {
      const date = new Date(scheduledAt)
      if (!scheduledAt || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        throw new Error('Choose a future interview time.')
      }
      return api.interviews.schedule(id,date.toISOString())
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interviews', 'queue'] }),
  })
  const updateStatus = useMutation({
    mutationFn: ({id,status}) => api.interviews.updateStatus(id,status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['interviews', 'queue'] }),
  })

  if (queue.isPending) return <PageSpinner />
  if (queue.error) return <ErrorState error={queue.error} onRetry={queue.refetch} />

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <h1 className="text-3xl">Technician interview queue</h1>
      <FormError>{schedule.error?.message || updateStatus.error?.message}</FormError>
      {queue.data.length === 0 ? <EmptyState title="No open interview requests" /> : (
        <ul className="space-y-4">
          {queue.data.map((item) => (
            <li key={item.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{item.business_name}</h2>
                  <p className="text-sm text-ink-soft">{item.kind} · {item.language}{item.claimed_years != null ? ` · ${item.claimed_years} years claimed` : ''}</p>
                  <p className="text-xs text-ink-soft">Requested {formatDateTime(item.created_at)}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
              {item.status === 'requested' ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-sm font-semibold">Schedule time
                    <input
                      className="input mt-1.5 font-normal"
                      type="datetime-local"
                      value={times[item.id] || ''}
                      onChange={(event) => setTimes((old) => ({...old,[item.id]:event.target.value}))}
                    />
                  </label>
                  <button type="button" className="btn btn-primary btn-sm" disabled={schedule.isPending} onClick={() => schedule.mutate({id:item.id,scheduledAt:times[item.id]})}>Schedule interview</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-ink-soft">{item.scheduled_at ? `Scheduled ${formatDateTime(item.scheduled_at)}` : ''}</p>
                  <StartCallButton recipientId={item.shop_user_id} context={{interviewRequestId:item.id}} children="Call technician" />
                  {item.status === 'scheduled' && <button type="button" className="btn btn-secondary btn-sm" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({id:item.id,status:'in_progress'})}>Mark in progress</button>}
                  {item.status === 'in_progress' && <button type="button" className="btn btn-primary btn-sm" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({id:item.id,status:'completed'})}>Complete interview</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
