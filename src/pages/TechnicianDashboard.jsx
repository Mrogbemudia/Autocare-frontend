import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { formatNaira } from '../lib/format.js'
import { EmptyState, ErrorState, FormError, PageSpinner, StatusBadge } from '../components/ui.jsx'
import { StartCallButton } from '../components/CallCenter.jsx'

export default function TechnicianDashboard() {
  const qc = useQueryClient()
  const dashboard = useQuery({ queryKey:['technician','dashboard'], queryFn:api.technician.dashboard })
  const grading = useQuery({ queryKey:['grading','status'], queryFn:api.grading.status })
  const interviews = useQuery({ queryKey:['interviews'], queryFn:api.interviews.list })
  const [attempt,setAttempt] = useState(null)
  const [answers,setAnswers] = useState({})
  const [kind,setKind] = useState('safety')
  const [assessmentMode,setAssessmentMode] = useState('text')
  const [claimedYears,setClaimedYears] = useState('5')
  const [language,setLanguage] = useState('en')
  const [docType,setDocType] = useState('nin')
  const [reference,setReference] = useState('')
  const [files,setFiles] = useState([])

  const start = useMutation({
    mutationFn: () => api.grading.start({
      kind,
      mode:assessmentMode,
      language,
      ...(kind === 'experience' ? { claimedYears:Number(claimedYears) } : {}),
    }),
    onSuccess:(paper) => { setAttempt(paper); setAnswers({}) },
  })
  const submit = useMutation({
    mutationFn: () => api.grading.submit(attempt.attemptId,
      Object.entries(answers).map(([questionId,chosenIndex]) => ({ questionId,chosenIndex:Number(chosenIndex) }))),
    onSuccess: () => { qc.invalidateQueries({queryKey:['grading','status']}); setAttempt(null); setAnswers({}) },
  })
  const interview = useMutation({
    mutationFn: () => api.interviews.request({ kind,language,claimedYears:Number(claimedYears) }),
    onSuccess: () => qc.invalidateQueries({queryKey:['interviews']}),
  })
  const documents = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('docType',docType)
      if (reference.trim()) form.append('referenceNumber',reference.trim())
      files.forEach((file) => form.append('documents',file))
      return api.documents.submit('shop',form)
    },
  })

  if (dashboard.isPending) return <PageSpinner />
  if (dashboard.error) return <ErrorState error={dashboard.error} onRetry={dashboard.refetch} />
  const data = dashboard.data

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl">{data.shop.business_name}</h1>
        <p className="mt-1 text-ink-soft">Technician dashboard · <StatusBadge status={data.shop.verification_status} /></p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-sub">Total revenue</p><p className="mt-2 text-2xl font-bold">{formatNaira(data.revenue_kobo)}</p></div>
        <div className="card p-5"><p className="text-sm text-sub">Work in progress</p><p className="mt-2 text-2xl font-bold">{data.jobs.in_progress}</p></div>
        <div className="card p-5"><p className="text-sm text-sub">Completed jobs</p><p className="mt-2 text-2xl font-bold">{data.completed.total}</p></div>
      </div>

      {data.shop.verification_status !== 'verified' ? (
        <EmptyState title="Verification required">After an admin verifies your technician profile, grading and interview actions become available.</EmptyState>
      ) : (
        <section className="card p-5">
          <h2 className="text-xl">Interview and grading</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-semibold">Assessment
              <select className="input mt-1.5 font-normal" value={kind} onChange={(e)=>setKind(e.target.value)}>
                <option value="safety">Safety gate</option><option value="experience">Experience</option>
              </select>
            </label>
            {kind === 'experience' && <label className="block text-sm font-semibold">Claimed years
              <input className="input mt-1.5 font-normal" type="number" min="0" max="60" value={claimedYears} onChange={(e)=>setClaimedYears(e.target.value)} />
            </label>}
            <label className="block text-sm font-semibold">Language
              <select className="input mt-1.5 font-normal" value={language} onChange={(e)=>setLanguage(e.target.value)}>
                <option value="en">English</option><option value="pcm">Nigerian Pidgin</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">Assessment format
              <select className="input mt-1.5 font-normal" value={assessmentMode} onChange={(e)=>setAssessmentMode(e.target.value)}>
                <option value="text">Text</option><option value="audio">Audio-supported</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={start.isPending} onClick={()=>start.mutate()}>
              {start.isPending ? 'Starting…' : 'Take assessment'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={interview.isPending} onClick={()=>interview.mutate()}>
              Request live interview
            </button>
          </div>
          <FormError>{start.error?.message || submit.error?.message || interview.error?.message}</FormError>
          {grading.error && <ErrorState error={grading.error} onRetry={grading.refetch} />}
          {grading.data && (
            <div className="mt-3 space-y-1 text-sm text-ink-soft">
              <p>Tier: {grading.data.tier} · {grading.data.points} points · Safety gate: {grading.data.safety_gate_passed ? 'passed' : 'pending'}</p>
              {grading.data.latest_attempts?.map((result) => (
                <p key={result.kind}>{result.kind}: {result.score_pct}% · {result.passed ? 'passed' : 'not passed'}{result.retake_after ? ` · Retake after ${new Date(result.retake_after).toLocaleString()}` : ''}</p>
              ))}
              {grading.error && <p role="alert" className="text-alert">{grading.error.message}</p>}
              {data.completed.latest_completed && <p>Latest completed job: {new Date(data.completed.latest_completed).toLocaleDateString()}</p>}
            </div>
          )}

          {attempt && (
            <form className="mt-5 space-y-4" onSubmit={(e)=>{e.preventDefault();submit.mutate()}}>
              {attempt.questions.map((question,index)=>(
                <fieldset key={question.id} className="rounded-md border border-line p-4">
                  <legend className="px-1 font-semibold">{index+1}. {question.body}</legend>
                  {question.audio_url && <audio className="mt-2 w-full" controls src={question.audio_url}>Audio playback is not supported by this browser.</audio>}
                  {question.options.map((option,optionIndex)=>(
                    <label key={optionIndex} className="mt-2 flex gap-2 text-sm">
                      <input type="radio" name={question.id} value={optionIndex} checked={answers[question.id]===String(optionIndex)} onChange={()=>setAnswers((old)=>({...old,[question.id]:String(optionIndex)}))} />
                      {option}
                    </label>
                  ))}
                </fieldset>
              ))}
              <button type="submit" className="btn btn-primary" disabled={submit.isPending || Object.keys(answers).length !== attempt.questions.length}>
                Submit assessment
            </button>
            </form>
          )}
          {interviews.error && <ErrorState error={interviews.error} onRetry={interviews.refetch} />}
          {interviews.data?.length > 0 && (
            <div className="mt-5"><h3 className="font-semibold">Interview requests</h3>
              <ul className="mt-2 space-y-2">{interviews.data.map((item)=><li key={item.id} className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge status={item.status} /> {item.kind} · {item.language}{item.scheduled_at&&` · ${new Date(item.scheduled_at).toLocaleString()}`}{item.status==='scheduled'&&item.interviewer_id&&<StartCallButton recipientId={item.interviewer_id} context={{interviewRequestId:item.id}} />}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="card p-5">
        <h2 className="text-xl">Verification documents</h2>
        <p className="mt-1 text-sm text-ink-soft">Submit NIN, CAC, apprenticeship letters, certificates, or supporting documents.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Document type
            <select className="input mt-1.5 font-normal" value={docType} onChange={(e)=>setDocType(e.target.value)}>
              <option value="nin">NIN</option><option value="cac">CAC</option><option value="apprenticeship_letter">Apprenticeship letter</option><option value="certificate">Certificate</option><option value="other">Supporting document</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Reference number (optional)
            <input className="input mt-1.5 font-normal" value={reference} onChange={(e)=>setReference(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold sm:col-span-2">Files
            <input className="input mt-1.5 font-normal" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={(e)=>setFiles(Array.from(e.target.files ?? []))} />
          </label>
        </div>
        <FormError>{documents.error?.message}</FormError>
        <button type="button" className="btn btn-primary mt-4" disabled={documents.isPending || files.length===0} onClick={()=>documents.mutate()}>
          {documents.isPending ? 'Uploading…' : 'Submit documents'}
        </button>
      </section>
    </div>
  )
}
