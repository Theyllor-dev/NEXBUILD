
import { useEffect, useMemo, useState } from "react";
import { FaDownload, FaChartBar, FaFileAlt, FaFilePdf } from "react-icons/fa";
import { API_URL } from "../../api";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import "./AdminPaginas.css";
import "./Relatorios.css";

const STATUS_PADRAO = ["Aberta", "Em análise", "Em atendimento", "Resolvida"];

function normalizarData(valor) {
  if (!valor) return null;

  const data = new Date(String(valor).replace(" ", "T"));

  return Number.isNaN(data.getTime()) ? null : data;
}

function Relatorios() {
  const [periodo, setPeriodo] = useState("todos");
  const [categoria, setCategoria] = useState("Todas");
  const [dadosOriginais, setDadosOriginais] = useState([]);
  const [categoriasBanco, setCategoriasBanco] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDados() {
      try {
        setCarregando(true);
        setErro("");

        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Sessão não encontrada. Faça login novamente.");
        }

        const opcoes = {
          headers: { Authorization: `Bearer ${token}` },
        };
        const [resOcorrencias, resCategorias] = await Promise.all([
          fetch(`${API_URL}/ocorrencias`, opcoes),
          fetch(`${API_URL}/categorias`, opcoes),
        ]);

        if (!resOcorrencias.ok) {
          throw new Error("Não foi possível buscar as ocorrências.");
        }

        if (!resCategorias.ok) {
          throw new Error("Não foi possível buscar as categorias.");
        }

        const [ocorrencias, categorias] = await Promise.all([
          resOcorrencias.json(),
          resCategorias.json(),
        ]);

        if (!Array.isArray(ocorrencias) || !Array.isArray(categorias)) {
          throw new Error("O servidor retornou dados em um formato inesperado.");
        }

        if (!ativo) return;

        setDadosOriginais(ocorrencias.map((item) => ({
          id: item.id_ocorrencia ?? item.id,
          titulo: item.titulo || "Ocorrência sem título",
          categoria: item.categoria_nome ?? item.nome_categoria ?? item.categoria ?? "Não informada",
          status: item.status || "Aberta",
          data: item.data_registro,
          prazo: item.prazo || null,
          prioridade: item.prioridade || "Não definida",
        })));

        setCategoriasBanco(
          categorias.map((item) => item.nome).filter(Boolean)
        );

      } catch (e) {
        if (ativo) {
          setErro(e.message || "Erro ao carregar os relatórios.");
        }
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarDados();

    return () => {
      ativo = false;
    };
  }, []);

  const categorias = useMemo(
    () => [
      ...new Set([
        ...categoriasBanco,
        ...dadosOriginais.map((d) => d.categoria)
      ])
    ].filter((c) => c && c !== "Não informada"),
    [categoriasBanco, dadosOriginais]
  );

  const dados = useMemo(() => {
    const agora = new Date();
    const limite = new Date(agora);

    if (periodo === "7") {
      limite.setDate(limite.getDate() - 7);
    }

    if (periodo === "30") {
      limite.setDate(limite.getDate() - 30);
    }

    return dadosOriginais.filter((item) => {
      const dataItem = normalizarData(item.data);

      const dentroPeriodo =
        periodo === "todos" || (dataItem && dataItem >= limite);

      const dentroCategoria =
        categoria === "Todas" || item.categoria === categoria;

      return dentroPeriodo && dentroCategoria;
    });
  }, [dadosOriginais, periodo, categoria]);

  const total = dados.length;

  const abertas = dados.filter(
    (item) => item.status === "Aberta"
  ).length;

  const atendimento = dados.filter(
    (item) => ["Em análise", "Em atendimento"].includes(item.status)
  ).length;

  const resolvidas = dados.filter(
    (item) => item.status === "Resolvida"
  ).length;

  const statusDisponiveis = [
    ...new Set([
      ...STATUS_PADRAO,
      ...dadosOriginais.map((d) => d.status)
    ])
  ];

  function exportarCSV() {
    const cabecalho = [
      "ID",
      "Título",
      "Categoria",
      "Prioridade",
      "Status",
      "Data de registro",
      "Prazo"
    ];

    const linhas = dados.map((item) => [
      item.id,
      item.titulo,
      item.categoria,
      item.prioridade,
      item.status,
      item.data || "",
      item.prazo || "Sem prazo",
    ]);

    const escapar = (valor) =>
      `"${String(valor ?? "").replace(/"/g, '""')}"`;

    const conteudo = [cabecalho, ...linhas]
      .map((linha) => linha.map(escapar).join(";"))
      .join("\r\n");

    const arquivo = new Blob(
      ["\uFEFF" + conteudo],
      { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");

    link.href = url;
    link.download = "relatorio-ocorrencias.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  const quantidadePorStatus = (nome) =>
    dados.filter((item) => item.status === nome).length;

  const quantidadePorCategoria = (nome) =>
    dados.filter((item) => item.categoria === nome).length;

  return (
    <div className="admin">
      <Sidebar />

      <main className="admin-content">
        <Header />

        <section className="relatorios-pagina">

          <div className="relatorios-cabecalho">
            <div>
              <span className="relatorios-etiqueta">
                <FaChartBar /> ANÁLISE DE DADOS
              </span>

              <h1>Relatórios</h1>

              <p>
                Acompanhe as ocorrências e visualize os resultados
                da gestão municipal.
              </p>
            </div>

            <div className="relatorios-acoes">
              <button
                className="relatorios-exportar relatorios-pdf"
                type="button"
                onClick={() => window.print()}
              >
                <FaFilePdf /> Exportar PDF
              </button>

              <button
                className="relatorios-exportar"
                type="button"
                onClick={exportarCSV}
                disabled={carregando || dados.length === 0}
              >
                <FaDownload /> Exportar CSV
              </button>
            </div>
          </div>

          <div className="relatorios-filtros">
            <label>
              Período

              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
              >
                <option value="todos">Todo o período</option>
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
              </select>
            </label>

            <label>
              Categoria

              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="Todas">Todas as categorias</option>

                {categorias.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {erro && (
            <p role="alert" className="relatorio-erro">
              {erro}
            </p>
          )}

          {carregando ? (
            <p role="status">
              Carregando relatórios do banco de dados...
            </p>
          ) : (
            <>

              <div className="relatorios-indicadores">

                <article className="relatorio-card">
                  <span>Total de ocorrências</span>
                  <strong>{total}</strong>
                  <small>Registros no filtro atual</small>
                </article>

                <article className="relatorio-card">
                  <span>Abertas</span>
                  <strong>{abertas}</strong>
                  <small>Aguardando atendimento</small>
                </article>

                <article className="relatorio-card">
                  <span>Em andamento</span>
                  <strong>{atendimento}</strong>
                  <small>Em análise ou atendimento</small>
                </article>

                <article className="relatorio-card">
                  <span>Resolvidas</span>
                  <strong>{resolvidas}</strong>
                  <small>Marcadas como concluídas</small>
                </article>

              </div>

              <div className="relatorios-graficos">

                <article className="relatorio-painel">
                  <h2>Ocorrências por status</h2>
                  <p>Distribuição dos registros filtrados.</p>

                  {statusDisponiveis.map((nome) => {
                    const quantidade = quantidadePorStatus(nome);

                    const largura = total
                      ? (quantidade / total) * 100
                      : 0;

                    return (
                      <div
                        className="relatorio-barra-item"
                        key={nome}
                      >
                        <div className="relatorio-barra-legenda">
                          <span>{nome}</span>
                          <strong>{quantidade}</strong>
                        </div>

                        <div className="relatorio-barra-fundo">
                          <div
                            className={`relatorio-barra status-${nome.toLowerCase().replaceAll(" ", "-")}`}
                            style={{ width: `${largura}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </article>

                <article className="relatorio-painel">
                  <h2>Ocorrências por categoria</h2>
                  <p>Volume de registros por tipo de problema.</p>

                  {categorias.map((nome) => {
                    const quantidade = quantidadePorCategoria(nome);

                    const largura = total
                      ? (quantidade / total) * 100
                      : 0;

                    return (
                      <div
                        className="relatorio-barra-item"
                        key={nome}
                      >
                        <div className="relatorio-barra-legenda">
                          <span>{nome}</span>
                          <strong>{quantidade}</strong>
                        </div>

                        <div className="relatorio-barra-fundo">
                          <div
                            className="relatorio-barra categoria-barra"
                            style={{ width: `${largura}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </article>

              </div>

              <article className="relatorio-painel relatorio-tabela-painel">

                <div className="relatorio-tabela-cabecalho">
                  <div>
                    <h2>Detalhamento das ocorrências</h2>
                    <p>Registros reais incluídos no relatório.</p>
                  </div>

                  <FaFileAlt />
                </div>

                <div className="relatorio-tabela-scroll">
                  <table className="relatorio-tabela">

                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Ocorrência</th>
                        <th>Categoria</th>
                        <th>Status</th>
                        <th>Data</th>
                        <th>Prazo</th>
                      </tr>
                    </thead>

                    <tbody>
                      {dados.map((item) => (
                        <tr key={item.id}>
                          <td>#{item.id}</td>
                          <td>{item.titulo}</td>
                          <td>{item.categoria}</td>

                          <td>
                            <span
                              className={`relatorio-status status-${item.status.toLowerCase().replaceAll(" ", "-")}`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td>
                            {normalizarData(item.data)?.toLocaleDateString("pt-BR") || "—"}
                          </td>

                          <td>
                            {item.prazo
                              ? new Date(
                                `${String(item.prazo).slice(0, 10)}T12:00:00`
                              ).toLocaleDateString("pt-BR")
                              : "Sem prazo"}
                          </td>
                        </tr>
                      ))}

                      {dados.length === 0 && (
                        <tr>
                          <td colSpan="6" className="relatorio-sem-dados">
                            Nenhuma ocorrência encontrada para esses filtros.
                          </td>
                        </tr>
                      )}
                    </tbody>

                  </table>
                </div>

                <small className="relatorio-aviso">
                  Dados carregados diretamente do banco de dados.
                </small>

              </article>

            </>
          )}

        </section>
      </main>
    </div>
  );
}

export default Relatorios;
