import { useState } from "react";

import { useNavigate } from "react-router-dom";



import { API_URL } from "../api";

import "./Carregamento.css";
import "./Log e Cad.css";




export default function LogeCad() {

  const [modo, setModo] = useState("login");

  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [nome, setNome] = useState("");

  const [email, setEmail] = useState("");

  const [senha, setSenha] = useState("");

  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [erro, setErro] = useState("");

  const [sucesso, setSucesso] = useState("");

  const [carregando, setCarregando] = useState(false);

  const [preparandoPainel, setPreparandoPainel] = useState(false);

  const navigate = useNavigate();



  function alternarModo(novoModo) {

    setModo(novoModo);

    setNome("");

    setEmail("");

    setSenha("");

    setConfirmarSenha("");

    setMostrarSenha(false);

    setErro("");

    setSucesso("");

  }



  async function handleSubmit(e) {

    e.preventDefault();

    setErro("");

    setSucesso("");

    if (modo === "cadastro" && senha !== confirmarSenha) {

      setErro("As senhas não são iguais!");

      return;

    }

    setCarregando(true);

    try {

      const url = `${API_URL}/${modo === "login" ? "login" : "cadastro"}`;

      const corpo =

        modo === "login" ? { email, senha } : { nome, email, senha };

      const resposta = await fetch(url, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify(corpo),

      });

      const dados = await resposta.json();

      if (!resposta.ok) {

        setErro(dados.erro || "Não foi possível concluir a operação.");

        return;

      }

      if (modo === "login") {

        if (!dados.token || !dados.id_usuario) {

          setErro("Resposta de login incompleta.");

          return;

        }

        const { token, ...usuario } = dados;

        localStorage.setItem("token", token);

        localStorage.setItem("usuario", JSON.stringify(usuario));



        setPreparandoPainel(true);

        try {

          const verificacao = await fetch(`${API_URL}/me`, {

            headers: { Authorization: `Bearer ${token}` },

          });

          if (!verificacao.ok)

            throw new Error("Não foi possível validar a sessão.");

          const atualizado = await verificacao.json();

          localStorage.setItem("usuario", JSON.stringify(atualizado));

          const tipo = String(

            atualizado.tipo_usuario || usuario.tipo_usuario || "",

          ).toLowerCase();

          const perfil = String(

            atualizado.perfil || usuario.perfil || "",

          ).toLowerCase();

          const cargo = String(

            atualizado.cargo || usuario.cargo || "",

          ).toLowerCase();

          const admin = tipo === "administrador" || perfil === "administrador";

          const funcionario =

            tipo === "funcionário" ||

            tipo === "funcionario" ||

            cargo === "funcionário" ||

            cargo === "funcionario";

          navigate(

            admin ? "/admin" : funcionario ? "/admin/minhas-tarefas" : "/",

            { replace: true },

          );

        } catch (erro) {

       

          const tipo = String(usuario.tipo_usuario || "").toLowerCase();

          const perfil = String(usuario.perfil || "").toLowerCase();

          const cargo = String(usuario.cargo || "").toLowerCase();

          navigate(

            tipo === "administrador" || perfil === "administrador"

              ? "/admin"

              : tipo === "funcionário" ||

                  tipo === "funcionario" ||

                  cargo === "funcionário" ||

                  cargo === "funcionario"

                ? "/admin/minhas-tarefas"

                : "/",

            { replace: true },

          );

        } finally {

          setPreparandoPainel(false);

        }

      } else {

        setSucesso("Cadastro realizado! Agora faça login.");

        setModo("login");

        setSenha("");

        setConfirmarSenha("");

      }

    } catch {

      setErro("Não foi possível conectar ao servidor.");

    } finally {

      setCarregando(false);

    }

  }



  if (preparandoPainel)

    return (

      <main className="nex-loading" role="status" aria-live="polite">

        <div className="nex-loading-card">

          <div className="nex-spinner" aria-hidden="true" />

          <h1>Preparando seu painel</h1>

          <p>Validando sua sessão e carregando seus dados...</p>

        </div>

      </main>

    );

  return (
    <main className="nex-auth-page">
      <div className="nex-auth-glow" aria-hidden="true" />
      <div className="nex-auth-shell">
        <header className="nex-auth-brand">
          <span className="nex-auth-brandmark" aria-hidden="true">N</span>
          <span>NexBuild</span>
        </header>

        <section className="nex-auth-card" aria-labelledby="nex-auth-title">
          <div className="nex-auth-card-top">
            <span className="nex-auth-eyebrow">ÁREA RESTRITA</span>
            <h1 id="nex-auth-title">{modo === "login" ? "Bem-vindo de volta" : "Criar uma conta"}</h1>
            <p>{modo === "login" ? "Entre com suas credenciais para acessar o painel." : "Preencha seus dados para solicitar acesso à plataforma."}</p>
          </div>

          <form onSubmit={handleSubmit} className="nex-auth-form">
            {modo === "cadastro" && (
              <div className="nex-auth-field">
                <label htmlFor="nome">Nome completo</label>
                <input id="nome" type="text" placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" required />
              </div>
            )}
            <div className="nex-auth-field">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div className="nex-auth-field">
              <label htmlFor="senha">Senha</label>
              <div className="nex-auth-password">
                <input id="senha" type={mostrarSenha ? "text" : "password"} placeholder="Digite sua senha" value={senha} onChange={e => setSenha(e.target.value)} autoComplete={modo === "login" ? "current-password" : "new-password"} minLength={6} required />
                <button type="button" onClick={() => setMostrarSenha(v => !v)} aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={mostrarSenha}>{mostrarSenha ? "Ocultar" : "Mostrar"}</button>
              </div>
            </div>
            {modo === "cadastro" && (
              <div className="nex-auth-field">
                <label htmlFor="confirmarSenha">Confirmar senha</label>
                <input id="confirmarSenha" type={mostrarSenha ? "text" : "password"} placeholder="Repita sua senha" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} autoComplete="new-password" minLength={6} required />
              </div>
            )}
            {modo === "login" && <p className="nex-auth-hint">Acesso exclusivo para usuários autorizados.</p>}
            {erro && <p className="nex-auth-alert" role="alert">{erro}</p>}
            {sucesso && <p className="nex-auth-success" role="status">{sucesso}</p>}
            <button className="nex-auth-submit" type="submit" disabled={carregando}>
              {carregando ? "Aguarde..." : modo === "login" ? "Entrar no painel" : "Criar conta"}
              <span aria-hidden="true">→</span>
            </button>
          </form>
          <div className="nex-auth-links">
            <a href="/">Voltar para a Home</a>
            <span aria-hidden="true">·</span>
            <a href="/denuncia">Registrar ocorrência</a>
          </div>
        </section>
        <footer className="nex-auth-footer">© 2026 NexBuild · Gestão urbana inteligente</footer>
      </div>
    </main>
  );
}
