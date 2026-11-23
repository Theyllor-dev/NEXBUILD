import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import "./GraficoDenuncias.css";
import { API_URL } from "../api";

const numero = (valor) => Number(valor) || 0;
const formatarData = (valor) => {
  const texto = String(valor ?? "");
  const partes = texto.slice(0, 10).split("-");
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : texto;
};

export default function GraficoDenuncias() {
  const [dados, setDados] = useState({ porCategoria: [], porDia: [] });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains("tema-claro"));

  useEffect(() => {
    const observer = new MutationObserver(() => setTemaClaro(document.body.classList.contains("tema-claro")));
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let ativo = true;
    let emAndamento = false;
    async function carregar() {
      if (emAndamento) return;
      emAndamento = true;
      try {
        const token = localStorage.getItem("token");
        const resposta = await fetch(`${API_URL}/estatisticas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resposta.ok) throw new Error(`Erro HTTP ${resposta.status}`);
        const json = await resposta.json();
        if (ativo) {
          setDados({
            porCategoria: Array.isArray(json.porCategoria) ? json.porCategoria : [],
            porDia: Array.isArray(json.porDia) ? json.porDia : [],
          });
          setErro("");
        }
      } catch (e) {
        if (ativo) setErro(e.message || "Não foi possível carregar os gráficos.");
      } finally {
        if (ativo) setCarregando(false);
        emAndamento = false;
      }
    }
    carregar();
    const intervalo = window.setInterval(carregar, 15000);
    window.addEventListener("nexbuild:ocorrencias-alteradas", carregar);
    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("nexbuild:ocorrencias-alteradas", carregar);
    };
  }, []);

  const categorias = useMemo(() => dados.porCategoria
    .map(item => ({ categoria: String(item.categoria || "Sem categoria"), quantidade: numero(item.quantidade) }))
    .filter(item => item.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade), [dados.porCategoria]);

  const evolucao = useMemo(() => dados.porDia
    .map(item => ({ data: String(item.dia ?? "").slice(0, 10), dia: formatarData(item.dia), denuncias: numero(item.quantidade) }))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-14), [dados.porDia]);

  const totalCategorias = categorias.reduce((soma, item) => soma + item.quantidade, 0);
  const totalPeriodo = evolucao.reduce((soma, item) => soma + item.denuncias, 0);
  const cor = temaClaro ? "#178a65" : "#a78bfa";
  const corTexto = temaClaro ? "#65746e" : "#a7b2c9";
  const corGrade = temaClaro ? "#e2e9e5" : "#29344d";
  const tooltip = {
    backgroundColor: temaClaro ? "#fff" : "#19243a",
    border: `1px solid ${corGrade}`,
    borderRadius: 12,
    color: temaClaro ? "#172b23" : "#f7f8ff",
    boxShadow: "0 12px 28px #0002",
  };

  return (
    <section className="graficos-dashboard" aria-label="Gráficos das denúncias">
      {erro && <div className="graficos-erro" role="alert">Não foi possível atualizar os gráficos: {erro}</div>}
      <article className="grafico-card">
        <div className="grafico-topo">
          <div><span className="grafico-etiqueta">VISÃO GERAL</span><h2>Denúncias por categoria</h2><p>Distribuição dos registros atuais</p></div>
          <div className="grafico-resumo"><strong>{totalCategorias}</strong><span>denúncias</span></div>
        </div>
        {categorias.length ? (
          <div className="grafico-area grafico-area-categorias" style={{ height: Math.max(175, categorias.length * 29 + 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorias} layout="vertical" margin={{ top: 6, right: 24, left: 4, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid stroke={corGrade} strokeDasharray="3 5" horizontal={false} />
                <XAxis type="number" allowDecimals={false} domain={[0, dataMax => Math.max(1, Math.ceil(dataMax))]} stroke={corTexto} fontSize={11} axisLine={false} tickLine={false} />
                <YAxis dataKey="categoria" type="category" width={112} tick={{ fill: corTexto, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltip} cursor={{ fill: corGrade, opacity: 0.3 }} formatter={valor => [`${valor} denúncia(s)`, "Quantidade"]} />
                <Bar dataKey="quantidade" fill={cor} radius={[0, 7, 7, 0]} maxBarSize={13} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="grafico-vazio">{carregando ? "Carregando categorias..." : "Nenhuma denúncia por categoria neste momento."}</div>}
        <div className="grafico-rodape"><span className="grafico-bolinha" /> Atualizado com dados do sistema</div>
      </article>

      <article className="grafico-card">
        <div className="grafico-topo">
          <div><span className="grafico-etiqueta">ACOMPANHAMENTO</span><h2>Evolução das denúncias</h2><p>Últimos {evolucao.length} dias disponíveis</p></div>
          <div className="grafico-resumo"><strong>{totalPeriodo}</strong><span>no período</span></div>
        </div>
        {evolucao.length ? (
          <div className="grafico-area grafico-area-evolucao">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolucao} margin={{ top: 16, right: 16, left: -22, bottom: 0 }}>
                <defs><linearGradient id="nexbuildAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={cor} stopOpacity={0.28} /><stop offset="100%" stopColor={cor} stopOpacity={0.01} /></linearGradient></defs>
                <CartesianGrid stroke={corGrade} strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="dia" stroke={corTexto} fontSize={10} axisLine={false} tickLine={false} minTickGap={18} />
                <YAxis allowDecimals={false} domain={[0, dataMax => Math.max(1, Math.ceil(dataMax))]} stroke={corTexto} fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltip} formatter={valor => [`${valor} denúncia(s)`, "Registradas"]} />
                <Area type="monotone" dataKey="denuncias" stroke={cor} strokeWidth={3} fill="url(#nexbuildAreaGradient)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: temaClaro ? "#fff" : "#111a2e" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : <div className="grafico-vazio">{carregando ? "Carregando evolução..." : "Nenhum registro no período disponível."}</div>}
        <div className="grafico-rodape"><span className="grafico-bolinha" /> Dados reais das ocorrências</div>
      </article>
    </section>
  );
}
