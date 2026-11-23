import {useEffect,useState} from 'react';
import {apiServico} from '../servicos';
import './AtribuirFuncionario.css';
export default function AtribuirFuncionario({ocorrenciaId,aoAtribuir}){
 const [equipes,setEquipes]=useState([]),[id,setId]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 const usuario=(()=>{try{return JSON.parse(localStorage.getItem('usuario')||'null')}catch{return null}})();
 const admin=usuario?.perfil==='Administrador';
 useEffect(()=>{if(!admin)return;let ativo=true;
 apiServico('/equipes-operacionais').then(d=>{if(!Array.isArray(d))throw Error('Resposta inválida ao listar equipes.');if(ativo)setEquipes(d)})
 .catch(e=>{if(ativo)setMsg(e.message)});return()=>{ativo=false}},[admin]);
 if(!admin)return null;
 return <form className="nex-atribuir" onSubmit={async e=>{e.preventDefault();setBusy(true);setMsg('');try{
 const d=await apiServico(`/ocorrencias/${ocorrenciaId}/atribuir-equipe`,{method:'POST',body:JSON.stringify({id_equipe:Number(id)})});
 setMsg(d.mensagem);setId('');await aoAtribuir?.();
 }catch(e){setMsg(e.message)}finally{setBusy(false)}}}>
 <label htmlFor={`equipe-${ocorrenciaId}`}>Encaminhar ocorrência para uma equipe</label>
 <select id={`equipe-${ocorrenciaId}`} value={id} disabled={busy} onChange={e=>setId(e.target.value)} required>
 <option value="">Selecione a equipe responsável</option>
 {equipes.map(e=><option key={e.id_equipe} value={e.id_equipe} disabled={Number(e.integrantes)===0}>{e.nome} — {e.integrantes}/3 funcionários</option>)}
 </select><button type="submit" disabled={!id||busy}>{busy?'Encaminhando...':'Enviar para equipe e notificar'}</button>
 {msg&&<small role="status">{msg}</small>}</form>;
}
