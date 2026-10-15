import { useCallback, useEffect, useState } from 'react';
import { api, uploadImage } from '../api';
import { useCatalog } from '../catalog';
import { useI18n } from '../i18n';
import { Field, Img, Modal, Msg, Spinner } from '../components/Ui';
import { money } from '../utils';

function ImageInput({ value, onChange }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setErr('');
    try { onChange(await uploadImage(file)); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      <Img src={value} className="h-16 w-24 rounded-lg" />
      <div className="space-y-1">
        <input type="file" accept="image/*" onChange={pick} className="text-sm" aria-label={t('upload')} />
        {busy && <p className="text-xs">{t('loading')}</p>}
        <Msg>{err}</Msg>
      </div>
    </div>
  );
}

// نموذج عام لإضافة/تعديل عنصر
function ItemModal({ fields, item, endpoint, onClose, onSaved }) {
  const { t } = useI18n();
  const [f, setF] = useState(item || Object.fromEntries(fields.map((x) => [x.key, x.type === 'checkbox' ? true : x.type === 'number' ? 0 : ''])));
  const [err, setErr] = useState('');
  const save = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const body = Object.fromEntries(fields.map((x) => [x.key, x.type === 'number' ? Number(f[x.key]) : f[x.key]]));
      if (item?.id) await api.put(`${endpoint}/${item.id}`, body); else await api.post(endpoint, body);
      onSaved();
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal title={item?.id ? t('edit') : t('add')} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {fields.map((x) => (
          <Field key={x.key} label={t(x.label)}>
            {x.type === 'textarea' ? <textarea className="input min-h-24" value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />
              : x.type === 'image' ? <ImageInput value={f[x.key]} onChange={(v) => setF({ ...f, [x.key]: v })} />
              : x.type === 'checkbox' ? <input type="checkbox" className="h-5 w-5 accent-gold-deep" checked={!!f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.checked })} />
              : <input className="input" type={x.type || 'text'} required={x.required} min={x.min} max={x.max} value={f[x.key]} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />}
          </Field>
        ))}
        <Msg>{err}</Msg>
        <button className="btn btn-dark w-full">{t('save')}</button>
      </form>
    </Modal>
  );
}

const CONFIG = {
  sections: { endpoint: '/admin/sections', fields: [
    { key: 'name', label: 'name', required: true }, { key: 'description', label: 'description', type: 'textarea' },
    { key: 'price', label: 'price', type: 'number', min: 0 }, { key: 'capacity', label: 'capacity', type: 'number', min: 1 },
    { key: 'image', label: 'image', type: 'image' }, { key: 'active', label: 'active', type: 'checkbox' }],
    cols: (s, t) => [s.name, `${money(s.price)} / ${t('per_hour')}`, `${s.capacity} ${t('guests_unit')}`, s.active ? '✓' : '—'] },
  services: { endpoint: '/admin/services', fields: [
    { key: 'name', label: 'name', required: true }, { key: 'description', label: 'description', type: 'textarea' },
    { key: 'icon', label: 'icon' }, { key: 'price', label: 'price', type: 'number', min: 0 }, { key: 'active', label: 'active', type: 'checkbox' }],
    cols: (s) => [`${s.icon} ${s.name}`, s.price > 0 ? money(s.price) : '—', '', s.active ? '✓' : '—'] },
  testimonials: { endpoint: '/admin/testimonials', fields: [
    { key: 'name', label: 'name', required: true }, { key: 'text', label: 'text', type: 'textarea' }, { key: 'rating', label: 'rating', type: 'number', min: 1, max: 5 }],
    cols: (s) => [s.name, '★'.repeat(s.rating), s.text.slice(0, 50), ''] },
};

function ItemsTable({ kind }) {
  const { t } = useI18n();
  const { reload } = useCatalog();
  const { endpoint, fields, cols } = CONFIG[kind];
  const [items, setItems] = useState(null);
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api.get(endpoint).then((d) => setItems(d.items)).catch((e) => setErr(e.message)), [endpoint]);
  useEffect(() => { load(); }, [load]);
  const refresh = () => { setModal(null); load(); reload(); };
  const remove = async (it) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try { await api.del(`${endpoint}/${it.id}`); refresh(); } catch (e) { setErr(e.message); }
  };
  if (!items) return <Spinner />;
  return (
    <div className="space-y-3">
      <Msg>{err}</Msg>
      <button className="btn btn-gold btn-sm" onClick={() => setModal({})}>+ {t('add')}</button>
      <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-ink/10">
        <table className="w-full"><tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-ink/5">
              {cols(it, t).map((c, i) => <td key={i} className="td">{c}</td>)}
              <td className="td text-end"><div className="flex justify-end gap-1">
                <button className="btn btn-line btn-sm" onClick={() => setModal(it)}>{t('edit')}</button>
                <button className="btn btn-line btn-sm text-wine" onClick={() => remove(it)}>{t('delete')}</button>
              </div></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      {modal && <ItemModal fields={fields} item={modal.id ? modal : null} endpoint={endpoint} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}

function HallForm() {
  const { t } = useI18n();
  const { data, reload } = useCatalog();
  const [f, setF] = useState(data?.hall);
  const [msg, setMsg] = useState({});
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const addImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { const url = await uploadImage(file); setF({ ...f, images: [...(f.images || []), url] }); } catch (e2) { setMsg({ err: e2.message }); }
  };
  const save = async (e) => {
    e.preventDefault(); setMsg({});
    try {
      const { id, ...body } = f;
      await api.put('/admin/hall', { ...body, capacity: Number(f.capacity), price_per_hour: Number(f.price_per_hour) });
      await reload(); setMsg({ ok: t('saved') });
    } catch (e2) { setMsg({ err: e2.message }); }
  };
  return (
    <form onSubmit={save} className="card grid gap-4 sm:grid-cols-2">
      <Field label={t('name')}><input className="input" required value={f.name} onChange={set('name')} /></Field>
      <Field label={t('tagline')}><input className="input" value={f.tagline} onChange={set('tagline')} /></Field>
      <div className="sm:col-span-2"><Field label={t('description')}><textarea className="input min-h-24" value={f.description} onChange={set('description')} /></Field></div>
      <Field label={t('capacity')}><input className="input" type="number" value={f.capacity} onChange={set('capacity')} /></Field>
      <Field label={t('address')}><input className="input" value={f.address} onChange={set('address')} /></Field>
      <Field label={t('phone')}><input className="input" dir="ltr" value={f.phone} onChange={set('phone')} /></Field>
      <Field label={t('email')}><input className="input" dir="ltr" value={f.email} onChange={set('email')} /></Field>
      <Field label="Instagram"><input className="input" dir="ltr" value={f.instagram} onChange={set('instagram')} /></Field>
      <Field label="Facebook"><input className="input" dir="ltr" value={f.facebook} onChange={set('facebook')} /></Field>
      <div className="sm:col-span-2"><Field label={t('map_url')}><input className="input" dir="ltr" value={f.map_embed_url} onChange={set('map_embed_url')} /></Field></div>
      <div className="sm:col-span-2">
        <span className="label">{t('gallery_images')}</span>
        <div className="flex flex-wrap gap-3">
          {(f.images || []).map((src, i) => (
            <div key={src + i} className="relative">
              <Img src={src} className="h-20 w-28 rounded-lg" />
              <button type="button" aria-label={t('delete')} onClick={() => setF({ ...f, images: f.images.filter((_, j) => j !== i) })} className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-wine text-white">×</button>
            </div>
          ))}
        </div>
        <input type="file" accept="image/*" onChange={addImage} className="mt-3 text-sm" aria-label={t('upload')} />
      </div>
      <div className="space-y-3 sm:col-span-2"><Msg>{msg.err}</Msg><Msg type="ok">{msg.ok}</Msg><button className="btn btn-dark">{t('save')}</button></div>
    </form>
  );
}

const SUGGESTIONS = [
  'يُمنع حضور الأطفال دون 16 سنة.',
  'يُمنع استعمال الألعاب النارية أو البارود على بُعد 100 متر من الجدار الخارجي للقاعة.',
  'يُمنع التدخين داخل القاعة.',
  'يلتزم الزبون بإنهاء المناسبة في الوقت المحدد.',
];

// شروط الأركان: يضيفها المسؤول، ويوافق عليها الزبون قبل الحجز
function RulesManager() {
  const { t } = useI18n();
  const { data, reload } = useCatalog();
  const [scope, setScope] = useState('general');
  const [rules, setRules] = useState(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => api.get('/admin/section-rules').then((d) => setRules(d.items)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const sid = scope === 'general' ? null : Number(scope);
  const list = (rules || []).filter((r) => r.section_id === sid);
  const act = async (fn) => { setErr(''); try { await fn(); await load(); reload(); } catch (e) { setErr(e.message); } };

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    act(async () => {
      await api.post('/admin/section-rules', { section_id: sid, text: text.trim(), sort_order: list.length ? Math.max(...list.map((r) => r.sort_order)) + 1 : 1 });
      setText('');
    });
  };
  const saveEdit = () => act(async () => { await api.put(`/admin/section-rules/${editing.id}`, { text: editing.text.trim() }); setEditing(null); });
  const remove = (r) => window.confirm(t('confirm_delete')) && act(() => api.del(`/admin/section-rules/${r.id}`));

  if (!rules) return <Spinner />;
  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-gold/15 px-4 py-2.5 text-sm">{t('rules_hint')}</p>
      <Field label={t('rules_scope')}>
        <select className="input !w-auto min-w-64" value={scope} onChange={(e) => { setScope(e.target.value); setEditing(null); }}>
          <option value="general">{t('rules_general')}</option>
          {data?.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Msg>{err}</Msg>

      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-start justify-between gap-3 !p-4">
            {editing?.id === r.id ? (
              <div className="w-full space-y-2">
                <textarea className="input min-h-20" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} maxLength={500} />
                <div className="flex gap-2"><button className="btn btn-dark btn-sm" onClick={saveEdit}>{t('save')}</button><button className="btn btn-line btn-sm" onClick={() => setEditing(null)}>{t('cancel')}</button></div>
              </div>
            ) : (
              <>
                <p className="min-w-0 flex-1 leading-7">{r.text}</p>
                <div className="flex gap-1">
                  <button className="btn btn-line btn-sm" onClick={() => setEditing({ id: r.id, text: r.text })}>{t('edit')}</button>
                  <button className="btn btn-line btn-sm text-wine" onClick={() => remove(r)}>{t('delete')}</button>
                </div>
              </>
            )}
          </li>
        ))}
        {!list.length && <li className="text-sm text-ink/60">{t('rules_none')}</li>}
      </ul>

      <form onSubmit={add} className="card space-y-3">
        <textarea className="input min-h-20" required minLength={3} maxLength={500} placeholder={t('rules_placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-ink/60">{t('rules_suggest')}:</span>
          {SUGGESTIONS.map((x) => <button type="button" key={x} onClick={() => setText(x)} className="rounded-full bg-ivory px-3 py-1 text-xs ring-1 ring-ink/15 hover:bg-gold/20">{x.length > 38 ? x.slice(0, 38) + '…' : x}</button>)}
        </div>
        <button className="btn btn-dark btn-sm">+ {t('add')}</button>
      </form>
    </div>
  );
}

export default function AdminCatalog() {
  const { t } = useI18n();
  const [tab, setTab] = useState('sections');
  const tabs = [['sections', 'tab_sections'], ['services', 'tab_services'], ['testimonials', 'tab_reviews'], ['rules', 'tab_rules'], ['hall', 'tab_hall']];
  return (
    <div className="space-y-5">
      <div role="tablist" className="flex gap-2 border-b border-ink/10">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 font-bold ${tab === k ? 'border-gold-deep' : 'border-transparent text-ink/50'}`}>{t(l)}</button>
        ))}
      </div>
      {tab === 'hall' ? <HallForm /> : tab === 'rules' ? <RulesManager /> : <ItemsTable key={tab} kind={tab} />}
    </div>
  );
}
