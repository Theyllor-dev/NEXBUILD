import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_URL } from '../api';
import './NotificacoesFlutuantes.css';

export default function NotificacoesFlutuantes() {
  const navigate = useNavigate();
  const [avisos,setAvisos] = useState([]);
  const timers = useRef(new Map());
  const touch = useRef({});
  const remover = id => {
    clearTimeout(timers.current.get(id)); timers.current.delete(id);
    setAvisos(v=>v.filter(a=>a.id!==id));
  };
  const avisar = (tipo,titulo,mensagem,url) => {
    const id = `${Date.now()}-${Math.random()}`;
    setAvisos(v=>[...v.slice(-2),{id,tipo,titulo,mensagem,url}]);
    timers.current.set(id,setTimeout(()=>remover(id),5500));
  };
  useEffect(()=>{
    const token = localStorage.getItem('token');
    if (!token) return;
    let usuario;
    try { usuario = JSON.parse(localStorage.getItem('usuario') || 'null'); } catch { return; }
    if (!usuario?.id_usuario) return;
    const chave = `nexbuild-boas-vindas-${usuario.id_usuario}`;
    if (!sessionStorage.getItem(chave)) {
      sessionStorage.setItem(chave,'1');
      const nome = String(usuario.nome || 'Usuário').trim().split(/\s+/)[0];
      avisar('boas-vindas',`Olá, ${nome}! 👋`,'Seja bem-vindo ao NexBuild.','/admin');
    }
    const socket = io(API_URL,{auth:{token}});
    socket.on('nova-notificacao-chat',n=>{
      const titulo=n.tipo==='privada' ? `Mensagem de ${n.remetente || 'alguém'}` : 'Nova mensagem da equipe';
      avisar('mensagem',titulo,n.mensagem,n.tipo==='privada' ? `/admin/chat?usuario=${n.id_remetente}` : `/admin/chat?canal=${encodeURIComponent(n.canal || 'geral')}`);
    });
    socket.on('nova-notificacao-servico',n=>avisar('ocorrencia',`Ocorrência #${n.id_ocorrencia}`,n.mensagem,usuario.perfil==='Administrador'?'/admin/denuncias':'/admin/minhas-tarefas'));
    socket.on('nova-notificacao-reuniao',n=>avisar('reuniao','Convite para reunião',n.mensagem,'/admin/agenda'));
    socket.on('agenda-atualizada',()=>window.dispatchEvent(new Event('nexbuild-agenda-atualizada')));
    return ()=>{socket.disconnect();for(const timer of timers.current.values())clearTimeout(timer);timers.current.clear();};
  },[]);
  const abrir = aviso => { remover(aviso.id); if(aviso.url) navigate(aviso.url); };
  return <div className="nex-toast-stack" aria-live="polite" aria-relevant="additions">
    {avisos.map(a=><div key={a.id} className={`nex-toast nex-toast-${a.tipo}`} role="status"
      onTouchStart={e=>{touch.current[a.id]=e.touches[0].clientX;}}
      onTouchEnd={e=>{const delta=e.changedTouches[0].clientX-(touch.current[a.id]??e.changedTouches[0].clientX);if(Math.abs(delta)>65)remover(a.id);}}>
      <button type="button" className="nex-toast-content" onClick={()=>abrir(a)}>
        <span className="nex-toast-icon" aria-hidden="true">{a.tipo==='mensagem'?'💬':a.tipo==='reuniao'?'📅':a.tipo==='ocorrencia'?'📋':'✨'}</span>
        <span className="nex-toast-text"><strong>{a.titulo}</strong><small>{a.mensagem}</small></span>
      </button>
      <button type="button" className="nex-toast-close" onClick={()=>remover(a.id)} aria-label="Dispensar notificação">×</button>
      <span className="nex-toast-progress" aria-hidden="true"/>
    </div>)}
  </div>;
}
