import { useEffect, useMemo, useState } from "react";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaPlus, FaClock, FaMapMarkerAlt, FaUsers, FaEdit, FaTrash, FaTimes, FaSearch } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import { apiServico } from "../../servicos";
import Header from "../../components/Header";
import "./Agenda.css";

const converterReuniao = r => ({
  id:r.id_reuniao, titulo:r.titulo, data:r.data_reuniao, horario:r.horario,
  duracao:String(r.duracao_minutos || 60), local:r.local_reuniao || '', descricao:r.descricao || '',
  equipesIds:(r.equipes || []).map(e=>String(e.id_equipe)),
  equipesNomes:(r.equipes || []).map(e=>e.nome),
  funcionariosIds:(r.participantes || []).map(u=>String(u.id_usuario)),
  participantes:(r.participantes || []).map(u=>u.nome).join(', ')
});
const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hoje = new Date();
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const criarVazio = (data) => ({ titulo:"", data, horario:"14:00", duracao:"60", local:"", participantes:"", equipesIds:[], funcionariosIds:[], descricao:"" });


export default function Agenda() {
  const [mes, setMes] = useState(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [dia, setDia] = useState(isoLocal(hoje));
  const [eventos, setEventos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(criarVazio(isoLocal(hoje)));
  const [erro, setErro] = useState("");
  const [equipes, setEquipes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const admin = (()=>{try{return JSON.parse(localStorage.getItem("usuario")||"null")?.perfil === "Administrador";}catch{return false;}})();
  const [erroEquipes, setErroEquipes] = useState("");
  const [carregandoEquipes, setCarregandoEquipes] = useState(false);
  const atualizarAgenda = async () => {
    try {
      const dados = await apiServico('/agenda/reunioes');
      setEventos((Array.isArray(dados) ? dados : []).map(converterReuniao));
      setErroLista('');
    } catch (e) { setErroLista(e.message); }
    finally { setCarregando(false); }
  };
  useEffect(() => {
    atualizarAgenda();
    const atualizar = () => atualizarAgenda();
    window.addEventListener('nexbuild-agenda-atualizada', atualizar);
    return () => window.removeEventListener('nexbuild-agenda-atualizada', atualizar);
  }, []);
  useEffect(() => {
    if (!modal) return;
    let ativo = true;
    setCarregandoEquipes(true);
    setErroEquipes("");
    if(admin) apiServico("/funcionarios").then(d=>{if(ativo)setFuncionarios(Array.isArray(d)?d:[]);}).catch(()=>{});
    apiServico("/agenda/equipes")
      .then(d => { if (ativo) setEquipes(Array.isArray(d) ? d : []); })
      .catch(e => { if (ativo) setErroEquipes(e.message); })
      .finally(() => { if (ativo) setCarregandoEquipes(false); });
    return () => { ativo = false; };
  }, [modal]);
  const alternarFuncionario = id => setForm(f=>({...f,funcionariosIds:(f.funcionariosIds||[]).includes(id)?f.funcionariosIds.filter(x=>x!==id):[...(f.funcionariosIds||[]),id]}));
  const alternarEquipe = (id) => setForm(f => ({ ...f, equipesIds: (f.equipesIds || []).includes(id) ? f.equipesIds.filter(v => v !== id) : [...(f.equipesIds || []), id] }));

  useEffect(() => { if (!modal) return; const old=document.body.style.overflow; document.body.style.overflow="hidden"; const esc=e=>{if(e.key==="Escape")setModal(false)}; document.addEventListener("keydown",esc); return ()=>{document.body.style.overflow=old;document.removeEventListener("keydown",esc)}; },[modal]);
  const inicio = new Date(mes.getFullYear(),mes.getMonth(),1).getDay();
  const total = new Date(mes.getFullYear(),mes.getMonth()+1,0).getDate();
  const celulas = Array.from({length:Math.ceil((inicio+total)/7)*7},(_,i)=>i-inicio+1);
  const mesLabel = mes.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  const filtrados = useMemo(()=>eventos.filter(e=>`${e.titulo} ${e.local} ${e.participantes} ${(e.equipesNomes||[]).join(" ")} ${e.descricao}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),[eventos,busca]);
  const doDia = filtrados.filter(e=>e.data===dia).sort((a,b)=>a.horario.localeCompare(b.horario));
  const proximas = filtrados.filter(e=>e.data>=isoLocal(hoje)).sort((a,b)=>`${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`)).slice(0,4);
  const mudarMes = n => { const d=new Date(mes.getFullYear(),mes.getMonth()+n,1); setMes(d); setDia(isoLocal(d)); };
  const abrirNovo = () => {setEditando(null);setForm(criarVazio(dia));setErro("");setModal(true)};
  const editar = e => {setEditando(e.id);setForm({titulo:e.titulo,data:e.data,horario:e.horario,duracao:e.duracao||"60",local:e.local||"",participantes:e.participantes||"",equipesIds:e.equipesIds||[],funcionariosIds:e.funcionariosIds||[],descricao:e.descricao||""});setErro("");setModal(true)};
  const salvar = async e => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.data || !form.horario) { setErro('Informe título, data e horário.'); return; }
    setSalvando(true); setErro('');
    try {
      await apiServico(editando ? `/agenda/reunioes/${editando}` : '/agenda/reunioes', {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify({titulo:form.titulo.trim(),data_reuniao:form.data,horario:form.horario,
          duracao_minutos:Number(form.duracao),local_reuniao:form.local,descricao:form.descricao,
          equipes:(form.equipesIds || []).map(Number),participantes:(form.funcionariosIds||[]).map(Number)})
      });
      await atualizarAgenda();
      setDia(form.data);
      const [ano,m] = form.data.split('-').map(Number);
      setMes(new Date(ano,m-1,1));setModal(false);
    } catch (e) {setErro(e.message);} finally {setSalvando(false);}
  };
  const excluir = async e => {
    if (!window.confirm(`Excluir a reunião "${e.titulo}"?`)) return;
    try {await apiServico(`/agenda/reunioes/${e.id}`,{method:'DELETE'});await atualizarAgenda();}
    catch(err){setErroLista(err.message);}
  };
  const cartao = e => <article className="agenda-evento" key={e.id}><div className="agenda-hora"><FaClock/> {e.horario}</div><div className="agenda-evento-info"><strong>{e.titulo}</strong>{e.local&&<small><FaMapMarkerAlt/> {e.local}</small>}{e.equipesNomes?.length>0&&<small><FaUsers/> {e.equipesNomes.join(", ")}</small>}{e.participantes&&<small><FaUsers/> {e.participantes}</small>}{e.descricao&&<p>{e.descricao}</p>}</div>{admin&&<div className="agenda-acoes"><button type="button" onClick={()=>editar(e)} aria-label={`Editar ${e.titulo}`} title="Editar"><FaEdit/></button><button type="button" onClick={()=>excluir(e)} aria-label={`Excluir ${e.titulo}`} title="Excluir"><FaTrash/></button></div>}</article>;
  return <div className="admin"><Sidebar/><main className="admin-content"><Header/><section className="agenda-page">
    <header className="agenda-topo"><div><span className="agenda-kicker">NEXBUILD · ORGANIZAÇÃO</span><h1>Agenda de reuniões</h1><p>Planeje encontros, registre pautas e acompanhe seus compromissos.</p></div>{admin&&<button type="button" className="agenda-primary" onClick={abrirNovo}><FaPlus/> Nova reunião</button>}</header>
    {erroLista && <p role="alert" className="agenda-error">{erroLista}</p>}{carregando && <p>Carregando reuniões...</p>}<div className="agenda-layout"><div className="agenda-main"><section className="agenda-panel agenda-calendario"><div className="agenda-cal-head"><div><span className="agenda-subtitle">CALENDÁRIO</span><h2>{mesLabel}</h2></div><div className="agenda-cal-actions"><button type="button" onClick={()=>{const d=new Date(hoje.getFullYear(),hoje.getMonth(),1);setMes(d);setDia(isoLocal(hoje))}}>Hoje</button><button type="button" aria-label="Mês anterior" onClick={()=>mudarMes(-1)}><FaChevronLeft/></button><button type="button" aria-label="Próximo mês" onClick={()=>mudarMes(1)}><FaChevronRight/></button></div></div><div className="agenda-grid">{diasSemana.map(d=><span className="agenda-weekday" key={d}>{d}</span>)}{celulas.map((n,i)=>n>0&&n<=total?(()=>{const data=isoLocal(new Date(mes.getFullYear(),mes.getMonth(),n));const qtd=eventos.filter(e=>e.data===data).length;return <button key={i} type="button" className={`agenda-day ${data===dia?"selecionado":""} ${data===isoLocal(hoje)?"atual":""}`} onClick={()=>setDia(data)} aria-label={`${n} de ${mesLabel}, ${qtd} reuniões`}><span>{n}</span>{qtd>0&&<i aria-hidden="true"/>}</button>})():<span key={i} className="agenda-day vazio"/>)}</div><div className="agenda-legenda"><span><i/> Dia com reunião</span><span>Selecione um dia para ver os detalhes</span></div></section><section className="agenda-panel agenda-dia"><div className="agenda-section-head"><div><span className="agenda-subtitle">COMPROMISSOS</span><h2>{new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"})}</h2></div><span className="agenda-count">{doDia.length} {doDia.length===1?"reunião":"reuniões"}</span></div>{doDia.length?doDia.map(cartao):<div className="agenda-vazio"><FaCalendarAlt/><strong>Nenhuma reunião neste dia</strong><p>Escolha outra data ou crie um compromisso.</p>{admin&&<button type="button" onClick={abrirNovo}>Adicionar reunião</button>}</div>}</section></div><aside className="agenda-lateral"><section className="agenda-panel"><span className="agenda-subtitle">ENCONTRE UM COMPROMISSO</span><label className="agenda-search"><FaSearch/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar reuniões..." aria-label="Pesquisar reuniões"/></label></section><section className="agenda-panel"><div className="agenda-section-head"><h2>Próximas reuniões</h2><FaCalendarAlt/></div>{proximas.length?<div className="agenda-proximas">{proximas.map(e=><button key={e.id} type="button" onClick={()=>{const [a,m]=e.data.split("-").map(Number);setMes(new Date(a,m-1,1));setDia(e.data)}}><span>{new Date(`${e.data}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</span><strong>{e.titulo}</strong><small>{e.horario}</small></button>)}</div>:<p className="agenda-muted">Nenhuma reunião futura cadastrada.</p>}</section><p className="agenda-local-note">Reuniões sincronizadas com o MySQL. Os convidados recebem avisos em tempo real.</p></aside></div>
  </section></main>{modal&&<div className="agenda-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><div className="agenda-modal" role="dialog" aria-modal="true" aria-labelledby="agenda-modal-titulo"><div className="agenda-modal-head"><div><span className="agenda-subtitle">NEXBUILD · AGENDA</span><h2 id="agenda-modal-titulo">{editando?"Editar reunião":"Nova reunião"}</h2></div><button type="button" onClick={()=>setModal(false)} aria-label="Fechar"><FaTimes/></button></div><form onSubmit={salvar}><label className="agenda-full">Título da reunião *<input required maxLength={120} value={form.titulo} onChange={e=>setForm({...form,titulo:e.target.value})} placeholder="Ex.: Alinhamento da equipe"/></label><label>Data *<input required type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></label><label>Horário *<input required type="time" value={form.horario} onChange={e=>setForm({...form,horario:e.target.value})}/></label><label>Duração (minutos)<select value={form.duracao} onChange={e=>setForm({...form,duracao:e.target.value})}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label><label>Local ou link<input maxLength={240} value={form.local} onChange={e=>setForm({...form,local:e.target.value})} placeholder="Sala, endereço ou link"/></label><div className="agenda-full agenda-team-picker"><div className="agenda-team-title"><FaUsers/><strong>Convidar equipes</strong></div><p>Selecione as equipes que devem participar da reunião.</p>{carregandoEquipes?<small>Carregando equipes...</small>:erroEquipes?<small className="agenda-error">{erroEquipes}</small>:equipes.length===0?<small>Nenhuma equipe cadastrada.</small>:<div className="agenda-team-list">{equipes.map(eq=>{const id=String(eq.id_equipe);return <label key={id} className="agenda-team-option"><input type="checkbox" checked={(form.equipesIds||[]).includes(id)} onChange={()=>alternarEquipe(id)}/><span><strong>{eq.nome}</strong><small>{eq.integrantes ?? 0} integrante(s)</small></span></label>})}</div>}<small className="agenda-team-warning">Funcionários ativos das equipes selecionadas recebem convites pelo NexBuild.</small></div><div className="agenda-full agenda-team-picker"><div className="agenda-team-title"><FaUsers/><strong>Convidar funcionários individualmente</strong></div><div className="agenda-team-list">{funcionarios.map(u=>{const id=String(u.id_usuario);return <label className="agenda-team-option" key={id}><input type="checkbox" checked={(form.funcionariosIds||[]).includes(id)} onChange={()=>alternarFuncionario(id)}/><span><strong>{u.nome}</strong><small>{u.setor||'Funcionário'}</small></span></label>})}</div></div><label className="agenda-full">Pauta / descrição<textarea rows="3" maxLength={3000} value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})} placeholder="Assuntos que serão discutidos..."/></label>{erro&&<p className="agenda-error" role="alert">{erro}</p>}<div className="agenda-modal-actions"><button type="button" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="agenda-primary" disabled={salvando}>{salvando?"Salvando...":editando?"Salvar alterações":"Criar reunião"}</button></div></form></div></div>}</div>;
}
