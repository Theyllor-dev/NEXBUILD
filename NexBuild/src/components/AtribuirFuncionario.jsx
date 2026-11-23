import { useEffect, useState } from 'react';
import { API_URL } from '../api';
import './AtribuirFuncionario.css';
export default function AtribuirFuncionario({ ocorrenciaId, aoAtribuir }) {
    const [equipes, setEquipes] = useState([]), [id, setId] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
    const usuario = (() => { try { return JSON.parse(localStorage.getItem('usuario') || 'null') } catch { return null } })();
    const admin = usuario?.perfil === 'Administrador';
    useEffect(() => {
        let ativo = true; fetch(`${API_URL}/equipes-operacionais`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
            .then(async r => { const d = await r.json(); if (!r.ok) throw Error(d.erro || 'Erro ao listar equipes'); return d })
            .then(d => { if (ativo) setEquipes(d) }).catch(e => { if (ativo) setMsg(e.message) }); return () => { ativo = false }
    }, []);
    if (!admin) return null;
    return <form className="nex-atribuir" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setMsg(''); try {
            const r = await fetch(`${API_URL}/ocorrencias/${ocorrenciaId}/atribuir-equipe`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify({ id_equipe: Number(id) }) });
            const d = await r.json(); if (!r.ok) throw Error(d.erro || 'Falha na atribuição'); setMsg(d.mensagem); await aoAtribuir?.();
        } catch (e) { setMsg(e.message) } finally { setBusy(false) }
    }}>
        <label htmlFor={`equipe-${ocorrenciaId}`}>Encaminhar ocorrência para uma equipe</label>
        <select id={`equipe-${ocorrenciaId}`} value={id} onChange={e => setId(e.target.value)} required>
            <option value="">Selecione a caixinha responsável</option>
            {equipes.map(e => <option key={e.id_equipe} value={e.id_equipe} disabled={Number(e.integrantes) === 0}>{e.nome} — {e.integrantes}/3 funcionários</option>)}
        </select><button type="submit" disabled={!id || busy}>{busy ? 'Encaminhando...' : 'Enviar para equipe e notificar'}</button>
        {msg && <small role="status">{msg}</small>}</form>;
}
