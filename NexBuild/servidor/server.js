import multer from "multer";
import { mkdirSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { obterEstatisticas } from "./Estatisticas.js";
import { db } from "./db.js";

import { createServer } from "node:http";

import { Server } from "socket.io";

import dotenv from "dotenv";

import express from "express";

import cors from "cors";

import notasIARoutes from "./NotasIA.js";
import { agendarAnaliseDenuncia } from "./AnaliseDenunciaIA.js";

import jwt from "jsonwebtoken";

import path from "node:path";

import { fileURLToPath } from "node:url";
// Carregar .env da pasta servidor
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env"),
});

console.log("JWT_SECRET carregada:", Boolean(process.env.JWT_SECRET));

import {
  listarNotasDoUsuario,
  criarNota as criarNotaBD,
  excluirNota as excluirNotaBD,
} from "./Notas.js";

import {
  criarUsuario,
  verificarLogin,
  listarUsuarios,
  buscarUsuarioPorId,
  atualizarUsuario,
  alterarStatusUsuario,
} from "./UsuarioBD.js";

import {
  listarCategorias,
  buscarCategoriaPorId,
  criarCategoria,
} from "./Categoria.js";

import {
  listarOcorrencias,
  buscarOcorrenciaPorId,
  criarOcorrencia,
  atualizarOcorrencia,
  excluirOcorrencia,
} from "./Ocorrencia.js";

import {
  listarLocalizacoes,
  buscarLocalizacao,
  criarLocalizacao,
} from "./Localizacoes.js";

import { listarHistorico, criarHistorico } from "./Historico-ocorrencias.js";

import {
  listarAtendimentos,
  criarAtendimento,
  listarEquipes,
} from "./Atendimento.js";

import {
  listarNotificacoes,
  criarNotificacao,
  marcarComoLida,
} from "./Notificacoes.js";

import { listarAnexos, criarAnexo } from "./Anexos.js";

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL }));

app.use(express.json({ limit: "10mb" }));

app.use("/notas/ia", notasIARoutes);
// ======================================================// MIDDLEWARE: VALIDAR ADMINISTRADOR// ======================================================
async function exigirAutenticacao(req, res, next) {
  try {
    const token = (req.headers.authorization || "").match(
      /^Bearer (.+)$/i,
    )?.[1];

    if (!token || !process.env.JWT_SECRET)
      return res.status(401).json({ erro: "Sessão inválida. Faça login." });

    const dados = jwt.verify(token, process.env.JWT_SECRET);

    const [linhas] = await db.execute(
      `SELECT

    id_usuario,

    nome,

    cargo,

    setor,

    id_equipe,

    perfil,

    tipo_usuario,

    status

   FROM usuarios

   WHERE id_usuario = ?

   LIMIT 1`,

      [dados.id_usuario],
    );

    const usuario = linhas[0];

    if (!usuario || usuario.status !== "Ativo")
      return res.status(403).json({ erro: "Conta desativada ou inexistente." });

    req.usuario = usuario;

    return next();
  } catch (erro) {
    return res.status(401).json({ erro: "Sessão expirada ou inválida." });
  }
}

function exigirAdministrador(req, res, next) {
  exigirAutenticacao(req, res, () => {
    if (req.usuario.perfil !== "Administrador") {
      return res.status(403).json({
        erro: "Acesso exclusivo de administradores.",
      });
    }

    req.administrador = req.usuario;

    next();
  });
}

async function exigirAcessoOcorrencia(req, res, next) {
  return exigirAutenticacao(req, res, async () => {
    try {
      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0)
        return res.status(400).json({ erro: "ID inválido." });

      if (req.usuario.perfil === "Administrador") {
        return next();
      }

      if (req.usuario.tipo_usuario !== "Funcionário") {
        return res.status(403).json({
          erro: "Acesso permitido somente a funcionários.",
        });
      }

      const [linhas] = await db.execute(
        `SELECT id_atribuicao FROM atribuicoes_ocorrencias

                 WHERE id_ocorrencia = ? AND id_funcionario = ? AND data_encerramento IS NULL LIMIT 1`,

        [id, req.usuario.id_usuario],
      );

      if (!linhas.length)
        return res

          .status(403)

          .json({ erro: "Ocorrência não atribuída a você." });

      return next();
    } catch (erro) {
      console.error("Erro ao validar atribuição:", erro);

      return res.status(500).json({ erro: "Erro ao verificar atribuição." });
    }
  });
}
// ======================================================// SERVIDOR HTTP E SOCKET.IO// ======================================================
const servidorHttp = createServer(app);

const io = new Server(servidorHttp, {
  cors: {
    origin: FRONTEND_URL,

    methods: ["GET", "POST"],
  },
});

const canaisChat = new Set([
  "geral",

  "infraestrutura",

  "atendimento",

  "administracao",

  "tecnologia",
]);

async function podeAcessarCanalEquipe(usuario, canal) {
  if (!/^equipe-[1-9]\d*$/.test(canal)) return false;
  const id = Number(canal.slice(7));
  if (usuario.perfil === 'Administrador') {
    const [r] = await db.execute('SELECT id_equipe FROM equipes WHERE id_equipe=?', [id]); return r.length > 0;
  }
  const [r] = await db.execute("SELECT id_usuario FROM usuarios WHERE id_usuario=? AND id_equipe=? AND tipo_usuario='Funcionário' AND status='Ativo'", [usuario.id_usuario, id]);
  return r.length > 0;
}
async function canalAutorizado(usuario, canal) {
  if (canal.startsWith('equipe-')) return podeAcessarCanalEquipe(usuario, canal);
  return canaisChat.has(canal);
}

async function prepararTabelaChat() {
  await db.execute(`



        CREATE TABLE IF NOT EXISTS mensagens_chat (



            id_mensagem BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,



            id_usuario INT NOT NULL,



            canal VARCHAR(40) NOT NULL DEFAULT 'geral',



            mensagem TEXT NOT NULL,



            data_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,



            PRIMARY KEY (id_mensagem),



            INDEX idx_chat_canal_data (canal, data_envio)



        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4



    `);
}

async function notificarChat(destinatarios, remetente, tipo, canal, texto) {
  const ids = [...new Set(destinatarios)].filter(id => id !== remetente);
  if (!ids.length) return;
  try {
    const [nomes] = await db.execute("SELECT nome FROM usuarios WHERE id_usuario=?", [remetente]);
    const nome = nomes[0]?.nome || "Usuário";
    for (const id of ids) {
      const [r] = await db.execute(`INSERT INTO notificacoes_chat
        (id_usuario,id_remetente,tipo,canal,mensagem) VALUES (?,?,?,?,?)`,
        [id, remetente, tipo, canal || null, texto.slice(0, 500)]);
      io.to(`usuario:${id}`).emit("nova-notificacao-chat", {
        id: r.insertId, tipo, canal, remetente: nome, id_remetente: remetente,
        mensagem: texto.slice(0, 500), lida: 0, data_notificacao: new Date().toISOString()
      });
    }
  } catch (erro) { console.error("Notificação do chat:", erro); }
}

app.get("/chat/usuarios", exigirAutenticacao, async (req, res) => {
  try {
    const [usuarios] = await db.execute("SELECT id_usuario,nome,tipo_usuario FROM usuarios WHERE status='Ativo' AND id_usuario <> ? ORDER BY nome", [req.usuario.id_usuario]);
    res.json(usuarios);
  } catch (erro) { console.error(erro); res.status(500).json({ erro: "Erro ao listar usuários." }); }
});
app.get("/chat/notificacoes", exigirAutenticacao, async (req, res) => {
  try {
    const [linhas] = await db.execute(`SELECT n.id_notificacao AS id,n.tipo,n.canal,n.mensagem,n.lida,
      n.id_remetente,u.nome AS remetente,n.data_notificacao
      FROM notificacoes_chat n JOIN usuarios u ON u.id_usuario=n.id_remetente
      WHERE n.id_usuario=? ORDER BY n.data_notificacao DESC,n.id_notificacao DESC LIMIT 100`, [req.usuario.id_usuario]);
    res.json(linhas);
  } catch (erro) { console.error(erro); res.status(500).json({ erro: "Erro ao carregar notificações." }); }
});
app.put("/chat/notificacoes/:id/lida", exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido." });
  try {
    await db.execute("UPDATE notificacoes_chat SET lida=1 WHERE id_notificacao=? AND id_usuario=?", [id, req.usuario.id_usuario]);
    res.json({ ok: true });
  } catch (erro) { console.error(erro); res.status(500).json({ erro: "Erro ao marcar notificação." }); }
});
app.put("/chat/notificacoes/lidas/todas", exigirAutenticacao, async (req, res) => {
  try {
    await db.execute("UPDATE notificacoes_chat SET lida=1 WHERE id_usuario=?", [req.usuario.id_usuario]);
    res.json({ ok: true });
  } catch (erro) { console.error(erro); res.status(500).json({ erro: "Erro ao marcar notificações." }); }
});

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token || !process.env.JWT_SECRET)
      return next(new Error("Faça login para acessar o chat."));

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const [usuarios] = await db.execute(
      `SELECT id_usuario, nome, email, cargo, perfil, status FROM usuarios WHERE id_usuario = ? LIMIT 1`,

      [payload.id_usuario],
    );

    if (!usuarios.length || usuarios[0].status !== "Ativo")
      return next(new Error("Conta desativada."));

    socket.data.usuario = usuarios[0];

    return next();
  } catch (erro) {
    return next(new Error("Sessão inválida ou expirada."));
  }
});

// Sala pessoal autenticada: permite entregar mensagens mesmo fora da página do chat.
io.on("connection", (socket) => {
  socket.join(`usuario:${socket.data.usuario.id_usuario}`);
  // Indicador efêmero: não grava conteúdo digitado nem envia para outros canais.
  socket.on("chat-digitando", (dados = {}) => {
    const eu = Number(socket.data.usuario.id_usuario);
    const ativo = dados.ativo === true;
    const tipo = dados.tipo;
    if (tipo === "privada") {
      const outro = Number(dados.alvo);
      if (!Number.isSafeInteger(outro) || outro <= 0 || outro === eu) return;
      io.to(`usuario:${outro}`).emit("chat-digitando", {
        tipo: "privada", alvo: outro, id_usuario: eu, nome: socket.data.usuario.nome, ativo
      });
    } else if (tipo === "canal") {
      const canal = String(dados.alvo || "");
      if (!socket.rooms.has(canal)) return;
      socket.to(canal).emit("chat-digitando", {
        tipo: "canal", alvo: canal, id_usuario: eu, nome: socket.data.usuario.nome, ativo
      });
    }
  });
  socket.on("listar-privadas", async (destinatarioInformado) => {
    const outro = Number(destinatarioInformado);
    const eu = socket.data.usuario.id_usuario;
    if (!Number.isSafeInteger(outro) || outro <= 0 || outro === eu) return;
    try {
      const [linhas] = await db.execute(`SELECT m.id_mensagem AS id, m.id_remetente AS id_usuario,
        m.id_destinatario, m.mensagem AS texto, DATE_FORMAT(m.data_envio, '%H:%i') AS horario,
        u.nome FROM mensagens_privadas m JOIN usuarios u ON u.id_usuario=m.id_remetente
        WHERE (m.id_remetente=? AND m.id_destinatario=?) OR (m.id_remetente=? AND m.id_destinatario=?)
        ORDER BY m.data_envio DESC, m.id_mensagem DESC LIMIT 100`, [eu, outro, outro, eu]);
      socket.emit("historico-privado", { usuario: outro, mensagens: linhas.reverse() });
    } catch (erro) { console.error("Histórico privado:", erro); socket.emit("chat-erro", "Erro ao buscar conversa privada."); }
  });
  socket.on("enviar-privada", async (dados = {}) => {
    const outro = Number(dados.destinatario);
    const texto = String(dados.texto || "").trim();
    const eu = socket.data.usuario.id_usuario;
    if (!Number.isSafeInteger(outro) || outro <= 0 || outro === eu || !texto || texto.length > 2000) return;
    try {
      const [ativos] = await db.execute("SELECT id_usuario FROM usuarios WHERE id_usuario IN (?,?) AND status='Ativo'", [eu, outro]);
      if (ativos.length !== 2) return socket.emit("chat-erro", "Destinatário indisponível.");
      const [r] = await db.execute("INSERT INTO mensagens_privadas (id_remetente,id_destinatario,mensagem) VALUES (?,?,?)", [eu, outro, texto]);
      const mensagem = { id: r.insertId, id_usuario: eu, id_destinatario: outro, nome: socket.data.usuario.nome, texto, horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
      io.to(`usuario:${eu}`).to(`usuario:${outro}`).emit("nova-privada", mensagem);
      await notificarChat([outro], eu, "privada", null, texto);
    } catch (erro) { console.error("Mensagem privada:", erro); socket.emit("chat-erro", "Não foi possível enviar a mensagem privada."); }
  });

  socket.on("entrar-canal", async (canalInformado) => {
    const [ativos] = await db.execute(
      "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND status = 'Ativo'",

      [socket.data.usuario.id_usuario],
    );

    if (!ativos.length) {
      socket.disconnect(true);

      return;
    }

    const canal = String(canalInformado || "");

    if (!(await canalAutorizado(socket.data.usuario, canal))) { socket.emit("chat-erro", "Você não pertence a esta equipe."); return; }

    for (const sala of socket.rooms) {
      if (canaisChat.has(sala) || sala.startsWith("equipe-")) {
        await socket.leave(sala);
      }
    }

    await socket.join(canal);

    try {
      const [linhas] = await db.execute(
        `SELECT



                    m.id_mensagem AS id,



                    m.canal,



                    m.mensagem AS texto,



                    m.data_envio AS data,



                    DATE_FORMAT(m.data_envio, '%H:%i') AS horario,



                    u.id_usuario,



                    u.nome



                 FROM mensagens_chat m



                 INNER JOIN usuarios u



                    ON u.id_usuario = m.id_usuario



                 WHERE m.canal = ?



                 ORDER BY m.data_envio DESC, m.id_mensagem DESC



                 LIMIT 100`,

        [canal],
      );

      socket.emit("historico-mensagens", {
        canal,

        mensagens: linhas.reverse(),
      });
    } catch (erro) {
      console.error(
        "Erro ao carregar histórico do chat:",

        erro,
      );

      socket.emit(
        "chat-erro",

        "Não foi possível carregar o histórico deste canal.",
      );
    }
  });

  socket.on("enviar-mensagem", async (dados = {}) => {
    const canal = String(dados.canal || "");

    const texto = String(dados.texto || "").trim();

    if (!(await canalAutorizado(socket.data.usuario, canal))) return;

    if (!socket.rooms.has(canal)) return;

    if (!texto || texto.length > 2000) return;

    try {
      const usuario = socket.data.usuario;

      const [ativos] = await db.execute(
        "SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND status = 'Ativo'",

        [usuario.id_usuario],
      );

      if (!ativos.length) {
        socket.emit("chat-erro", "Conta desativada.");

        socket.disconnect(true);

        return;
      }

      const [resultado] = await db.execute(
        `INSERT INTO mensagens_chat



                    (id_usuario, canal, mensagem)



                 VALUES (?, ?, ?)`,

        [usuario.id_usuario, canal, texto],
      );

      const [linhas] = await db.execute(
        `SELECT



                    m.id_mensagem AS id,



                    m.canal,



                    m.mensagem AS texto,



                    m.data_envio AS data,



                    DATE_FORMAT(m.data_envio, '%H:%i') AS horario,



                    u.id_usuario,



                    u.nome



                 FROM mensagens_chat m



                 INNER JOIN usuarios u



                    ON u.id_usuario = m.id_usuario



                 WHERE m.id_mensagem = ?



                 LIMIT 1`,

        [resultado.insertId],
      );

      if (linhas.length) {
        io.to(canal).emit("nova-mensagem", linhas[0]);
        const [destinatarios] = canal.startsWith('equipe-')
          ? await db.execute(`SELECT id_usuario FROM usuarios WHERE status='Ativo' AND
              (id_equipe=? OR perfil='Administrador') AND id_usuario<>?`, [Number(canal.slice(7)), usuario.id_usuario])
          : await db.execute("SELECT id_usuario FROM usuarios WHERE status='Ativo' AND id_usuario <> ?", [usuario.id_usuario]);
        await notificarChat(destinatarios.map(x => x.id_usuario), usuario.id_usuario, "canal", canal, texto);

      }
    } catch (erro) {
      console.error("Erro ao salvar mensagem do chat:", erro);

      socket.emit(
        "chat-erro",

        "Não foi possível salvar a mensagem.",
      );
    }
  });
});

// ===================== AGENDA DE REUNIÕES =====================
// Requer as tabelas reunioes, reunioes_equipes, reunioes_participantes e notificacoes_reunioes.
const agendaId = v => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const agendaEquipe = u => u.perfil === 'Administrador' || u.tipo_usuario === 'Funcionário';
const agendaDataValida = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const agendaHoraValida = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const agendaListaIds = v => Array.isArray(v) && v.length <= 100 && v.every(x => agendaId(x) !== null) ? [...new Set(v.map(Number))] : null;

app.get('/agenda/equipes', exigirAutenticacao, async (req, res) => {
  if (!agendaEquipe(req.usuario)) return res.status(403).json({ erro: 'Acesso restrito.' });
  try {
    const [equipes] = await db.execute(`SELECT e.id_equipe,e.nome,e.especialidade,COUNT(u.id_usuario) AS integrantes
      FROM equipes e LEFT JOIN usuarios u ON u.id_equipe=e.id_equipe AND u.tipo_usuario='Funcionário' AND u.status='Ativo'
      GROUP BY e.id_equipe,e.nome,e.especialidade ORDER BY e.nome`);
    return res.json(equipes);
  } catch (e) { console.error('Agenda equipes:', e); return res.status(500).json({ erro: 'Erro ao consultar equipes.' }); }
});

app.get('/agenda/reunioes', exigirAutenticacao, async (req, res) => {
  if (!agendaEquipe(req.usuario)) return res.status(403).json({ erro: 'Acesso restrito.' });
  try {
    const admin = req.usuario.perfil === 'Administrador';
    const [reunioes] = await db.execute(`SELECT DISTINCT r.id_reuniao,r.titulo,
      DATE_FORMAT(r.data_reuniao,'%Y-%m-%d') AS data_reuniao,
      TIME_FORMAT(r.horario,'%H:%i') AS horario,r.duracao_minutos,r.local_reuniao,r.descricao,r.criado_por,r.data_criacao
      FROM reunioes r
      ${admin ? '' : `JOIN reunioes_participantes p ON p.id_reuniao=r.id_reuniao AND p.id_usuario=?`}
      ORDER BY r.data_reuniao,r.horario,r.id_reuniao`, admin ? [] : [req.usuario.id_usuario]);
    if (!reunioes.length) return res.json([]);
    const ids = reunioes.map(r => r.id_reuniao);
    const marks = ids.map(() => '?').join(',');
    const [equipes] = await db.query(`SELECT re.id_reuniao,re.id_equipe,e.nome FROM reunioes_equipes re JOIN equipes e ON e.id_equipe=re.id_equipe WHERE re.id_reuniao IN (${marks})`, ids);
    const [participantes] = await db.query(`SELECT rp.id_reuniao,rp.id_usuario,u.nome,rp.confirmado FROM reunioes_participantes rp JOIN usuarios u ON u.id_usuario=rp.id_usuario WHERE rp.id_reuniao IN (${marks})`, ids);
    return res.json(reunioes.map(r => ({ ...r, equipes: equipes.filter(e => e.id_reuniao === r.id_reuniao), participantes: participantes.filter(p => p.id_reuniao === r.id_reuniao) })));
  } catch (e) { console.error('Agenda listar:', e); return res.status(500).json({ erro: 'Erro ao carregar reuniões. Confira as tabelas da agenda.' }); }
});

async function agendaSalvar(req, res, edicao = false) {
  const id = edicao ? agendaId(req.params.id) : null;
  if (edicao && !id) return res.status(400).json({ erro: 'ID inválido.' });
  const body = req.body || {};
  const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
  const data = body.data_reuniao ?? body.data;
  const horario = body.horario;
  const duracao = Number(body.duracao_minutos ?? 60);
  const local = String(body.local_reuniao ?? body.local ?? '').trim();
  const descricao = String(body.descricao ?? '').trim();
  const equipes = agendaListaIds(body.equipes ?? body.ids_equipes ?? []);
  const individuais = agendaListaIds(body.participantes ?? body.ids_usuarios ?? []);
  if (!titulo || titulo.length > 120 || !agendaDataValida(data) || !agendaHoraValida(horario) || !Number.isSafeInteger(duracao) || duracao < 15 || duracao > 1440 || local.length > 240 || descricao.length > 10000 || equipes === null || individuais === null)
    return res.status(400).json({ erro: 'Confira título, data, horário, duração, equipes e participantes.' });
  const cx = await db.getConnection();
  try {
    await cx.beginTransaction();
    if (edicao) {
      const [existente] = await cx.execute('SELECT id_reuniao FROM reunioes WHERE id_reuniao=? FOR UPDATE', [id]);
      if (!existente.length) { await cx.rollback(); return res.status(404).json({ erro: 'Reunião não encontrada.' }); }
    }
    if (equipes.length) {
      const [validas] = await cx.query(`SELECT id_equipe FROM equipes WHERE id_equipe IN (${equipes.map(() => '?').join(',')})`, equipes);
      if (validas.length !== equipes.length) { await cx.rollback(); return res.status(400).json({ erro: 'Uma das equipes não existe.' }); }
    }
    if (individuais.length) {
      const [validos] = await cx.query(`SELECT id_usuario FROM usuarios WHERE id_usuario IN (${individuais.map(() => '?').join(',')}) AND tipo_usuario='Funcionário' AND status='Ativo'`, individuais);
      if (validos.length !== individuais.length) { await cx.rollback(); return res.status(400).json({ erro: 'Um dos participantes não é funcionário ativo.' }); }
    }
    let reuniaoId = id;
    if (edicao) {
      await cx.execute('UPDATE reunioes SET titulo=?,data_reuniao=?,horario=?,duracao_minutos=?,local_reuniao=?,descricao=? WHERE id_reuniao=?', [titulo, data, horario + ':00', duracao, local || null, descricao || null, id]);
    } else {
      const [r] = await cx.execute('INSERT INTO reunioes(titulo,data_reuniao,horario,duracao_minutos,local_reuniao,descricao,criado_por) VALUES(?,?,?,?,?,?,?)', [titulo, data, horario + ':00', duracao, local || null, descricao || null, req.usuario.id_usuario]);
      reuniaoId = r.insertId;
    }
    const [anteriores] = edicao ? await cx.execute('SELECT id_usuario FROM reunioes_participantes WHERE id_reuniao=?', [reuniaoId]) : [[]];
    const anterioresSet = new Set(anteriores.map(x => x.id_usuario));
    await cx.execute('DELETE FROM reunioes_equipes WHERE id_reuniao=?', [reuniaoId]);
    for (const eq of equipes) await cx.execute('INSERT INTO reunioes_equipes(id_reuniao,id_equipe) VALUES(?,?)', [reuniaoId, eq]);
    let membros = [];
    if (equipes.length) {
      const [rows] = await cx.query(`SELECT id_usuario FROM usuarios WHERE id_equipe IN (${equipes.map(() => '?').join(',')}) AND tipo_usuario='Funcionário' AND status='Ativo'`, equipes);
      membros = rows.map(x => x.id_usuario);
    }
    const destinatarios = [...new Set([...membros, ...individuais])];
    await cx.execute('DELETE FROM reunioes_participantes WHERE id_reuniao=?', [reuniaoId]);
    for (const userId of destinatarios) await cx.execute('INSERT INTO reunioes_participantes(id_reuniao,id_usuario) VALUES(?,?)', [reuniaoId, userId]);
    const novos = destinatarios.filter(x => !anterioresSet.has(x));
    const mensagem = `Você foi convidado para a reunião "${titulo}" em ${data.split('-').reverse().join('/')} às ${horario}.`.slice(0, 500);
    const notificacoes = [];
    for (const userId of novos) {
      const [n] = await cx.execute('INSERT INTO notificacoes_reunioes(id_reuniao,id_usuario,mensagem) VALUES(?,?,?)', [reuniaoId, userId, mensagem]);
      notificacoes.push({ id_usuario: userId, id_notificacao: n.insertId, mensagem });
    }
    await cx.commit();
    for (const n of notificacoes) io.to(`usuario:${n.id_usuario}`).emit('nova-notificacao-reuniao', { ...n, id_reuniao: reuniaoId, lida: 0 });
    for (const userId of destinatarios) io.to(`usuario:${userId}`).emit('agenda-atualizada', { id_reuniao: reuniaoId });
    return res.status(edicao ? 200 : 201).json({ ok: true, id_reuniao: reuniaoId, convidados: destinatarios.length, notificacoes_enviadas: novos.length });
  } catch (e) { await cx.rollback(); console.error('Agenda salvar:', e); return res.status(500).json({ erro: 'Erro ao salvar reunião. Confira o esquema do MySQL.' }); }
  finally { cx.release(); }
}
app.post('/agenda/reunioes', exigirAdministrador, (req, res) => agendaSalvar(req, res));
app.put('/agenda/reunioes/:id', exigirAdministrador, (req, res) => agendaSalvar(req, res, true));
app.delete('/agenda/reunioes/:id', exigirAdministrador, async (req, res) => {
  const id = agendaId(req.params.id); if (!id) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    const [membros] = await db.execute('SELECT id_usuario FROM reunioes_participantes WHERE id_reuniao=?', [id]);
    const [r] = await db.execute('DELETE FROM reunioes WHERE id_reuniao=?', [id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Reunião não encontrada.' });
    for (const u of membros) io.to(`usuario:${u.id_usuario}`).emit('agenda-atualizada', { id_reuniao: id, excluida: true });
    return res.json({ ok: true });
  } catch (e) { console.error('Agenda excluir:', e); return res.status(500).json({ erro: 'Erro ao excluir reunião.' }); }
});
app.get('/agenda/notificacoes', exigirAutenticacao, async (req, res) => {
  try { const [rows] = await db.execute(`SELECT id_notificacao,id_reuniao,mensagem,lida,criada_em FROM notificacoes_reunioes WHERE id_usuario=? ORDER BY criada_em DESC,id_notificacao DESC LIMIT 100`, [req.usuario.id_usuario]); return res.json(rows); }
  catch (e) { console.error('Agenda notificações:', e); return res.status(500).json({ erro: 'Erro ao carregar notificações.' }); }
});
app.put('/agenda/notificacoes/:id/lida', exigirAutenticacao, async (req, res) => {
  const id = agendaId(req.params.id); if (!id) return res.status(400).json({ erro: 'ID inválido.' });
  try { await db.execute('UPDATE notificacoes_reunioes SET lida=1 WHERE id_notificacao=? AND id_usuario=?', [id, req.usuario.id_usuario]); return res.json({ ok: true }); }
  catch (e) { console.error('Agenda marcar lida:', e); return res.status(500).json({ erro: 'Erro ao marcar notificação.' }); }
});
// =================== FIM DA AGENDA ===================

// ======================================================// ROTA INICIAL// ======================================================
app.get("/", (req, res) => {
  res.json({
    mensagem: "Servidor funcionando!",
  });
});
// As rotas de usuários continuam a partir daqui.
app.get("/categorias", async (req, res) => {
  try {
    const categorias = await listarCategorias();

    return res.json(categorias);
  } catch (erro) {
    console.error("Erro ao listar categorias:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar categorias.",
    });
  }
});

app.get("/categorias/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: "ID de categoria inválido.",
    });
  }

  try {
    const categoria = await buscarCategoriaPorId(id);

    if (!categoria) {
      return res.status(404).json({
        erro: "Categoria não encontrada.",
      });
    }

    return res.json(categoria);
  } catch (erro) {
    console.error("Erro ao buscar categoria:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar categoria.",
    });
  }
});

app.post(
  "/categorias",

  exigirAdministrador,

  async (req, res) => {
    try {
      const { nome, descricao } = req.body || {};

      if (typeof nome !== "string" || !nome.trim()) {
        return res.status(400).json({
          erro: "Informe o nome da categoria.",
        });
      }

      const categoria = await criarCategoria(
        nome.trim(),

        String(descricao || "").trim(),
      );

      return res.status(201).json({
        mensagem: "Categoria criada com sucesso.",

        categoria,
      });
    } catch (erro) {
      console.error("Erro ao criar categoria:", erro);

      return res.status(500).json({
        erro: "Erro ao criar categoria.",
      });
    }
  },
);
// ======================================================// USUÁRIOS// ======================================================// Cadastro público: cria somente contas comuns.// O gerenciamento de usuários continua protegido em POST /usuario.
app.post("/cadastro", (_req, res) => res.status(403).json({ erro: "Cadastro público desativado. Contas internas são criadas pelo administrador." }));

app.post("/usuario", exigirAdministrador, async (req, res) => {
  try {
    const {
      nome,

      email,

      senha,

      cargo,

      setor,

      perfil,

      tipo_usuario,
    } = req.body || {};

    if (
      typeof nome !== "string" ||
      !nome.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof senha !== "string" ||
      senha.length < 6 ||
      typeof cargo !== "string" ||
      !cargo.trim() ||
      typeof setor !== "string" ||
      !setor.trim() ||
      !["Usuário", "Administrador"].includes(perfil) ||
      !["Cidadão", "Funcionário", "Administrador"].includes(tipo_usuario) ||
      (perfil === "Administrador") !== (tipo_usuario === "Administrador")
    ) {
      return res.status(400).json({
        erro: "Preencha os campos corretamente. A senha deve ter pelo menos 6 caracteres.",
      });
    }

    const usuario = await criarUsuario({
      nome: nome.trim(),

      email: email.trim(),

      senha,

      cargo: cargo.trim(),

      setor: setor.trim(),

      perfil,

      tipo_usuario,
    });

    return res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",

      usuario,
    });
  } catch (erro) {
    if (
      erro.message === "EMAIL_JA_CADASTRADO" ||
      erro.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        erro: "Este e-mail já está cadastrado.",
      });
    }

    console.error("Erro ao cadastrar usuário:", erro);

    return res.status(500).json({
      erro: "Erro ao cadastrar usuário.",
    });
  }
});

app.get("/usuarios", exigirAdministrador, async (req, res) => {
  try {
    const usuarios = await listarUsuarios();

    return res.json(usuarios);
  } catch (erro) {
    console.error("Erro ao listar usuários:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar usuários.",
    });
  }
});

app.get("/usuarios/:id", exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      erro: "ID de usuário inválido.",
    });
  }

  try {
    const usuario = await buscarUsuarioPorId(id);

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado.",
      });
    }

    return res.json(usuario);
  } catch (erro) {
    console.error("Erro ao buscar usuário:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar usuário.",
    });
  }
});

app.put("/usuarios/:id", exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id);

  const {
    nome,

    email,

    cargo,

    setor,

    perfil,

    tipo_usuario,
  } = req.body || {};

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof nome !== "string" ||
    !nome.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof cargo !== "string" ||
    !cargo.trim() ||
    typeof setor !== "string" ||
    !setor.trim() ||
    !["Usuário", "Administrador"].includes(perfil) ||
    !["Cidadão", "Funcionário", "Administrador"].includes(tipo_usuario) ||
    (perfil === "Administrador") !== (tipo_usuario === "Administrador")
  ) {
    return res.status(400).json({
      erro: "Preencha todos os campos corretamente.",
    });
  }

  if (id === req.administrador.id_usuario && perfil !== "Administrador") {
    return res.status(400).json({
      erro: "Você não pode remover seu próprio perfil de administrador.",
    });
  }

  try {
    const usuario = await atualizarUsuario(id, {
      nome: nome.trim(),

      email: email.trim(),

      cargo: cargo.trim(),

      setor: setor.trim(),

      perfil,

      tipo_usuario,
    });

    if (!usuario) {
      return res.status(404).json({
        erro: "Usuário não encontrado.",
      });
    }

    return res.json({
      mensagem: "Usuário atualizado com sucesso.",

      usuario,
    });
  } catch (erro) {
    if (erro.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        erro: "Este e-mail já está cadastrado.",
      });
    }

    console.error("Erro ao atualizar usuário:", erro);

    return res.status(500).json({
      erro: "Erro ao atualizar usuário.",
    });
  }
});

app.patch(
  "/usuarios/:id/status",

  exigirAdministrador,

  async (req, res) => {
    const id = Number(req.params.id);

    const { status } = req.body || {};

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !["Ativo", "Inativo"].includes(status)
    ) {
      return res.status(400).json({
        erro: "ID ou status inválido.",
      });
    }

    if (id === req.administrador.id_usuario && status === "Inativo") {
      return res.status(400).json({
        erro: "Você não pode desativar sua própria conta.",
      });
    }

    try {
      const usuario = await alterarStatusUsuario(id, status);

      if (!usuario) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      return res.json({
        mensagem: `Usuário ${status.toLowerCase()} com sucesso.`,

        usuario,
      });
    } catch (erro) {
      console.error("Erro ao alterar status:", erro);

      return res.status(500).json({
        erro: "Erro ao alterar status do usuário.",
      });
    }
  },
);

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body || {};

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof senha !== "string" ||
      !senha
    ) {
      return res.status(400).json({
        erro: "Informe e-mail e senha.",
      });
    }

    const usuario = await verificarLogin(email.trim(), senha);

    if (!usuario) {
      return res.status(401).json({
        erro: "E-mail ou senha incorretos, ou conta inativa.",
      });
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,

        cargo: usuario.cargo,

        perfil: usuario.perfil,
      },

      process.env.JWT_SECRET,

      { expiresIn: "8h" },
    );

    return res.json({ ...usuario, token });
  } catch (erro) {
    console.error("Erro no login:", erro);

    return res.status(500).json({
      erro: "Erro interno no login.",
    });
  }
});
// ======================================================// OCORRÊNCIAS// ======================================================
// Estatísticas reais do MySQL para os gráficos e indicadores.
app.get("/estatisticas", exigirAutenticacao, async (req, res) => {
  if (req.usuario.tipo_usuario !== "Funcionário" && req.usuario.perfil !== "Administrador") {
    return res.status(403).json({ erro: "Acesso restrito à equipe." });
  }
  try { return res.json(await obterEstatisticas()); }
  catch (erro) {
    console.error("Erro nas estatísticas:", erro);
    return res.status(500).json({ erro: "Erro ao carregar estatísticas." });
  }
});

app.get("/ocorrencias", exigirAutenticacao, async (req, res) => {
  if (
    req.usuario.tipo_usuario !== "Funcionário" &&
    req.usuario.perfil !== "Administrador"
  ) {
    return res.status(403).json({ erro: "Acesso restrito à equipe." });
  }

  try {
    return res.json(await listarOcorrencias());
  } catch (erro) {
    console.error("Erro ao buscar ocorrências:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar ocorrências.",
    });
  }
});
// Acesso filtrado para o dashboard de funcionários.
async function notificarServico(idUsuario, idOcorrencia, mensagem) {
  try {
    const [r] = await db.execute(
      'INSERT INTO notificacoes (id_usuario, id_ocorrencia, mensagem) VALUES (?, ?, ?)',
      [idUsuario, idOcorrencia, mensagem]
    );
    io.to(`usuario:${idUsuario}`).emit('nova-notificacao-servico', {
      id_notificacao: r.insertId, id_ocorrencia: idOcorrencia, mensagem, lida: 0
    });
  } catch (erro) { console.error('Notificação de serviço:', erro.message); }
}


// ===== Equipes operacionais: uma caixa compartilhada por até três funcionários =====
app.get('/equipes-operacionais', exigirAutenticacao, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT e.id_equipe,e.nome,e.especialidade,
      COUNT(u.id_usuario) AS integrantes FROM equipes e
      LEFT JOIN usuarios u ON u.id_equipe=e.id_equipe AND u.tipo_usuario='Funcionário' AND u.status='Ativo'
      GROUP BY e.id_equipe,e.nome,e.especialidade ORDER BY e.nome`);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Execute a migração de equipes no MySQL.' }); }
});
app.post('/equipes-operacionais', exigirAdministrador, async (req, res) => {
  const nome = String(req.body?.nome || '').trim(), especialidade = String(req.body?.especialidade || '').trim();
  if (!nome || nome.length > 100 || !especialidade || especialidade.length > 100) return res.status(400).json({ erro: 'Informe nome e especialidade (até 100 caracteres).' });
  try { const [r] = await db.execute('INSERT INTO equipes(nome,especialidade) VALUES(?,?)', [nome, especialidade]); res.status(201).json({ id_equipe: r.insertId, nome, especialidade }); }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao criar equipe.' }); }
});
app.put('/usuarios/:id/equipe', exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id), equipe = Number(req.body?.id_equipe);
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(equipe) || equipe < 1) return res.status(400).json({ erro: 'Selecione uma equipe válida.' });
  const cx = await db.getConnection();
  try {
    await cx.beginTransaction();
    const [users] = await cx.execute("SELECT id_usuario,tipo_usuario FROM usuarios WHERE id_usuario=? FOR UPDATE", [id]);
    if (!users.length || users[0].tipo_usuario !== 'Funcionário') { await cx.rollback(); return res.status(400).json({ erro: 'Somente funcionários podem integrar equipes.' }); }
    const [teams] = await cx.execute('SELECT id_equipe FROM equipes WHERE id_equipe=? FOR UPDATE', [equipe]);
    if (!teams.length) { await cx.rollback(); return res.status(404).json({ erro: 'Equipe não encontrada.' }); }
    const [count] = await cx.execute("SELECT COUNT(*) AS total FROM usuarios WHERE id_equipe=? AND tipo_usuario='Funcionário' AND status='Ativo' AND id_usuario<>?", [equipe, id]);
    if (count[0].total >= 3) { await cx.rollback(); return res.status(409).json({ erro: 'Esta equipe já possui três funcionários ativos.' }); }
    await cx.execute('UPDATE usuarios SET id_equipe=? WHERE id_usuario=?', [equipe, id]);
    await cx.commit(); res.json({ mensagem: 'Funcionário vinculado à equipe.' });
  } catch (e) { await cx.rollback(); console.error(e); res.status(500).json({ erro: 'Erro ao vincular equipe.' }); } finally { cx.release(); }
});
app.get('/equipes-operacionais/minha', exigirAutenticacao, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT e.id_equipe,e.nome,e.especialidade FROM equipes e
    JOIN usuarios u ON u.id_equipe=e.id_equipe WHERE u.id_usuario=?`, [req.usuario.id_usuario]); res.json(rows[0] || null);
  }
  catch (e) { res.status(500).json({ erro: 'Erro ao consultar equipe.' }); }
});
app.post('/ocorrencias/:id/atribuir-equipe', exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id), equipe = Number(req.body?.id_equipe);
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(equipe) || equipe < 1) return res.status(400).json({ erro: 'Ocorrência ou equipe inválida.' });
  const cx = await db.getConnection();
  try {
    await cx.beginTransaction();
    const [os] = await cx.execute('SELECT id_ocorrencia FROM ocorrencias WHERE id_ocorrencia=? FOR UPDATE', [id]);
    const [es] = await cx.execute('SELECT id_equipe,nome FROM equipes WHERE id_equipe=?', [equipe]);
    if (!os.length || !es.length) { await cx.rollback(); return res.status(404).json({ erro: 'Ocorrência ou equipe não encontrada.' }); }
    const [membros] = await cx.execute("SELECT id_usuario FROM usuarios WHERE id_equipe=? AND tipo_usuario='Funcionário' AND status='Ativo'", [equipe]);
    if (!membros.length) { await cx.rollback(); return res.status(400).json({ erro: 'Cadastre pelo menos um funcionário ativo nessa equipe.' }); }
    await cx.execute('UPDATE atribuicoes_equipes SET data_encerramento=NOW() WHERE id_ocorrencia=? AND data_encerramento IS NULL', [id]);
    await cx.execute('INSERT INTO atribuicoes_equipes(id_ocorrencia,id_equipe,id_administrador) VALUES(?,?,?)', [id, equipe, req.usuario.id_usuario]);
    await cx.execute('INSERT INTO atendimentos(id_ocorrencia,id_equipe,observacao) VALUES(?,?,?)', [id, equipe, `Encaminhada à equipe ${es[0].nome}`]);
    await cx.execute(`INSERT INTO historico_ocorrencias(id_ocorrencia,id_usuario,status_anterior,novo_status,observacao)
      SELECT id_ocorrencia,?,status,status,? FROM ocorrencias WHERE id_ocorrencia=?`, [req.usuario.id_usuario, `Encaminhada à equipe ${es[0].nome}`, id]);
    await cx.commit();
    await Promise.all(membros.map(u => notificarServico(u.id_usuario, id, `A equipe ${es[0].nome} recebeu a ocorrência #${id}.`)));
    res.status(201).json({ mensagem: `Ocorrência encaminhada à equipe ${es[0].nome}.` });
  } catch (e) { await cx.rollback(); console.error(e); res.status(500).json({ erro: 'Erro ao encaminhar ocorrência à equipe.' }); } finally { cx.release(); }
});

app.get("/ocorrencias/atribuidas", exigirAutenticacao, async (req, res) => {
  try {
    if (req.usuario.perfil === "Administrador") {
      return res.json(await listarOcorrencias());
    }

    if (req.usuario.tipo_usuario !== "Funcionário") {
      return res.status(403).json({
        erro: "Acesso permitido somente a funcionários.",
      });
    }

    const [linhas] = await db.execute(
      `SELECT DISTINCT o.*, c.nome AS categoria_nome, l.endereco AS rua,

                    l.bairro, l.cidade, l.latitude, l.longitude

             FROM ocorrencias o

             JOIN atribuicoes_ocorrencias a ON a.id_ocorrencia = o.id_ocorrencia

             LEFT JOIN categorias c ON c.id_categoria = o.id_categoria

             LEFT JOIN localizacoes l ON l.id_ocorrencia = o.id_ocorrencia

             WHERE a.id_funcionario = ? AND a.data_encerramento IS NULL

             ORDER BY o.data_registro DESC`,

      [req.usuario.id_usuario],
    );

    return res.json(linhas);
  } catch (erro) {
    console.error("Erro ao listar atribuições:", erro);

    return res.status(500).json({ erro: "Erro ao listar atribuições." });
  }
});

app.get("/funcionarios", exigirAdministrador, async (req, res) => {
  try {
    const [linhas] = await db.execute(
      `SELECT id_usuario, nome, email, setor, status FROM usuarios

             WHERE tipo_usuario = 'Funcionário' AND status = 'Ativo' ORDER BY nome`,
    );

    return res.json(linhas);
  } catch (erro) {
    return res.status(500).json({ erro: "Erro ao listar funcionários." });
  }
});

app.post(
  "/ocorrencias/:id/atribuicao",

  exigirAdministrador,

  async (req, res) => {
    const id = Number(req.params.id);

    const funcionario = Number(req.body?.id_funcionario);

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(funcionario) ||
      funcionario <= 0
    )
      return res.status(400).json({ erro: "IDs inválidos." });

    const conexao = await db.getConnection();

    try {
      await conexao.beginTransaction();

      const [ocorrencias] = await conexao.execute(
        "SELECT id_ocorrencia FROM ocorrencias WHERE id_ocorrencia = ? FOR UPDATE",

        [id],
      );

      if (!ocorrencias.length) {
        await conexao.rollback();

        return res.status(404).json({ erro: "Ocorrência não encontrada." });
      }

      const [usuarios] = await conexao.execute(
        `SELECT id_usuario

   FROM usuarios

   WHERE id_usuario = ?

     AND tipo_usuario = 'Funcionário'

     AND status = 'Ativo'

   LIMIT 1`,

        [funcionario],
      );

      if (!usuarios.length) {
        await conexao.rollback();

        return res.status(400).json({ erro: "Funcionário não está ativo." });
      }

      await conexao.execute(
        "UPDATE atribuicoes_ocorrencias SET data_encerramento = NOW() WHERE id_ocorrencia = ? AND data_encerramento IS NULL",

        [id],
      );

      await conexao.execute(
        "INSERT INTO atribuicoes_ocorrencias (id_ocorrencia, id_funcionario, id_administrador) VALUES (?, ?, ?)",

        [id, funcionario, req.usuario.id_usuario],
      );

      await conexao.commit();
      await notificarServico(funcionario, id, `Você recebeu a ocorrência #${id}.`);

      return res

        .status(201)

        .json({ mensagem: "Funcionário atribuído com sucesso." });
    } catch (erro) {
      await conexao.rollback();

      console.error("Erro ao atribuir ocorrência:", erro);

      return res.status(500).json({ erro: "Erro ao atribuir ocorrência." });
    } finally {
      conexao.release();
    }
  },
);

// ===== Central de ordens de serviço: exige MIGRACAO_ORDENS_SERVICO.sql =====
const OS_ETAPAS = [
  ['analise', 'Denúncia analisada'], ['vistoria', 'Vistoria técnica realizada'],
  ['orcamento', 'Orçamento elaborado'], ['aprovacao', 'Orçamento aprovado'],
  ['execucao', 'Serviço executado'], ['relatorio', 'Relatório técnico finalizado'],
  ['encerramento', 'Atendimento encerrado']
];
const osDir = path.join(__dirname, 'arquivos-os');
const osUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) { mkdirSync(osDir, { recursive: true }); cb(null, osDir) },
    filename(_req, _file, cb) { cb(null, randomUUID()) }
  }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter(_req, file, cb) {
    const tipos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(tipos.includes(file.mimetype) ? null : new Error('Envie JPG, PNG, WebP ou PDF.'), tipos.includes(file.mimetype));
  }
});
const osAdmin = u => u.perfil === 'Administrador';
async function osPermissao(id, u) {
  if (osAdmin(u)) {
    const [r] = await db.execute('SELECT id_ocorrencia FROM ocorrencias WHERE id_ocorrencia=?', [id]); return !!r.length;
  }
  if (u.tipo_usuario !== 'Funcionário') return false;
  const [r] = await db.execute(`SELECT 1 FROM atribuicoes_equipes a JOIN usuarios u ON u.id_equipe=a.id_equipe
 WHERE a.id_ocorrencia=? AND u.id_usuario=? AND a.data_encerramento IS NULL LIMIT 1`, [id, u.id_usuario]);
  return !!r.length;
}
async function osEvento(id, u, tipo, descricao) {
  await db.execute('INSERT INTO os_eventos(id_ocorrencia,id_usuario,tipo,descricao) VALUES(?,?,?,?)', [id, u.id_usuario, tipo, descricao]);
  const [pessoas] = await db.execute(`SELECT DISTINCT u.id_usuario FROM usuarios u
 LEFT JOIN atribuicoes_equipes a ON a.id_equipe=u.id_equipe AND a.id_ocorrencia=? AND a.data_encerramento IS NULL
 WHERE u.status='Ativo' AND (u.perfil='Administrador' OR (a.id_ocorrencia IS NOT NULL AND u.tipo_usuario='Funcionário'))`, [id]);
  for (const p of pessoas) io.to(`usuario:${p.id_usuario}`).emit('os-atualizada', { id_ocorrencia: id });
}
// Visão administrativa completa: todas as equipes e ordens, não apenas conclusões pendentes.
app.get('/os/pendentes', exigirAdministrador, async (req, res) => {
  try {
    const [r] = await db.execute(`SELECT o.id_ocorrencia,o.titulo,o.descricao,o.prioridade,o.status AS status_ocorrencia,
   o.data_registro,e.id_equipe,e.nome AS equipe_nome,c.status AS status_conclusao,c.atualizado_em,
   COALESCE(c.status,'Em atendimento') AS status,
   b.status AS status_orcamento,b.valor AS valor_orcamento,
   (SELECT COUNT(*) FROM os_anexos an WHERE an.id_ocorrencia=o.id_ocorrencia) AS total_anexos,
   (SELECT COUNT(*) FROM os_etapas et WHERE et.id_ocorrencia=o.id_ocorrencia AND et.concluida=1) AS etapas_concluidas,
   (SELECT COUNT(*) FROM os_relatorios re WHERE re.id_ocorrencia=o.id_ocorrencia) AS total_relatorios,
   (SELECT COUNT(*) FROM os_eventos ev WHERE ev.id_ocorrencia=o.id_ocorrencia) AS total_eventos
   FROM atribuicoes_equipes a JOIN ocorrencias o ON o.id_ocorrencia=a.id_ocorrencia
   JOIN equipes e ON e.id_equipe=a.id_equipe
   LEFT JOIN os_conclusoes c ON c.id_ocorrencia=o.id_ocorrencia
   LEFT JOIN os_orcamentos b ON b.id_ocorrencia=o.id_ocorrencia
   WHERE a.data_encerramento IS NULL
   ORDER BY (c.status='Solicitada') DESC,(b.status='Pendente') DESC,o.data_registro DESC`);
    res.json(r);
  } catch (e) { console.error('Erro na central de operações:', e); res.status(500).json({ erro: 'Erro ao consultar ordens de serviço. Confira a migração SQL.' }) }
});
app.get('/os/:id', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id); if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ erro: 'ID inválido.' });
  try {
    if (!await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Sem acesso à ordem de serviço.' });
    for (const [codigo, titulo] of OS_ETAPAS) await db.execute('INSERT IGNORE INTO os_etapas(id_ocorrencia,codigo,titulo) VALUES(?,?,?)', [id, codigo, titulo]);
    const [[etapas], [eventos], [orcamentos], [relatorios], [anexos], [conclusoes]] = await Promise.all([
      db.execute(`SELECT e.*,u.nome AS responsavel FROM os_etapas e LEFT JOIN usuarios u ON u.id_usuario=e.id_responsavel WHERE e.id_ocorrencia=? ORDER BY e.id_etapa`, [id]),
      db.execute(`SELECT ev.*,u.nome AS autor FROM os_eventos ev JOIN usuarios u ON u.id_usuario=ev.id_usuario WHERE ev.id_ocorrencia=? ORDER BY ev.criado_em DESC,ev.id_evento DESC LIMIT 150`, [id]),
      db.execute('SELECT * FROM os_orcamentos WHERE id_ocorrencia=?', [id]),
      db.execute('SELECT * FROM os_relatorios WHERE id_ocorrencia=?', [id]),
      db.execute(`SELECT a.id_anexo,a.nome_original,a.tipo_mime,a.criado_em,u.nome AS autor FROM os_anexos a JOIN usuarios u ON u.id_usuario=a.id_usuario WHERE a.id_ocorrencia=? ORDER BY a.criado_em DESC`, [id]),
      db.execute('SELECT * FROM os_conclusoes WHERE id_ocorrencia=?', [id])
    ]);
    res.json({ etapas, eventos, orcamento: orcamentos[0] || null, relatorio: relatorios[0] || null, anexos, conclusao: conclusoes[0] || null, administrador: osAdmin(req.usuario) });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao carregar ordem de serviço. Confira a migração SQL.' }) }
});

async function osBloquearEncerrada(req, res, next) {
  const id = Number(req.params.id);
  try {
    const [r] = await db.execute("SELECT status FROM os_conclusoes WHERE id_ocorrencia=?", [id]);
    if (r[0]?.status === 'Aprovada') return res.status(409).json({ erro: 'Ordem de serviço já encerrada.' });
    next();
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao verificar encerramento.' }) }
}
app.put('/os/:id/etapas/:codigo', exigirAutenticacao, osBloquearEncerrada, async (req, res) => {
  const id = Number(req.params.id), codigo = req.params.codigo, feito = req.body?.concluida === true;
  if (!OS_ETAPAS.some(e => e[0] === codigo)) return res.status(400).json({ erro: 'Etapa inválida.' });
  try {
    if (!await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Sem acesso.' });
    if (['aprovacao', 'encerramento'].includes(codigo)) return res.status(403).json({ erro: 'Etapa controlada pelo administrador.' });
    if (codigo === 'orcamento') { const [r] = await db.execute('SELECT 1 FROM os_orcamentos WHERE id_ocorrencia=?', [id]); if (feito && !r.length) return res.status(409).json({ erro: 'Registre o orçamento primeiro.' }) }
    if (codigo === 'relatorio') { const [r] = await db.execute('SELECT 1 FROM os_relatorios WHERE id_ocorrencia=?', [id]); if (feito && !r.length) return res.status(409).json({ erro: 'Preencha o relatório primeiro.' }) }
    await db.execute('INSERT IGNORE INTO os_etapas(id_ocorrencia,codigo,titulo) VALUES(?,?,?)', [id, codigo, OS_ETAPAS.find(e => e[0] === codigo)[1]]);
    await db.execute('UPDATE os_etapas SET concluida=?,id_responsavel=?,data_conclusao=? WHERE id_ocorrencia=? AND codigo=?', [feito ? 1 : 0, feito ? req.usuario.id_usuario : null, feito ? new Date() : null, id, codigo]);
    await osEvento(id, req.usuario, 'etapa', `${feito ? 'Concluiu' : 'Reabriu'}: ${OS_ETAPAS.find(e => e[0] === codigo)[1]}`); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao atualizar etapa.' }) }
});
app.put('/os/:id/orcamento', exigirAutenticacao, osBloquearEncerrada, async (req, res) => {
  const id = Number(req.params.id), valor = Number(req.body?.valor), obs = String(req.body?.observacoes || '').trim();
  if (!Number.isFinite(valor) || valor < 0 || valor > 9999999999 || obs.length > 4000) return res.status(400).json({ erro: 'Orçamento inválido.' });
  try {
    if (!await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Sem acesso.' });
    const [old] = await db.execute('SELECT status FROM os_orcamentos WHERE id_ocorrencia=?', [id]);
    if (old[0]?.status === 'Aprovado' && !osAdmin(req.usuario)) return res.status(409).json({ erro: 'Orçamento aprovado não pode ser editado pela equipe.' });
    await db.execute(`INSERT INTO os_orcamentos(id_ocorrencia,valor,observacoes,status,id_autor) VALUES(?,?,?,'Pendente',?)
 ON DUPLICATE KEY UPDATE valor=VALUES(valor),observacoes=VALUES(observacoes),status='Pendente',id_autor=VALUES(id_autor),id_aprovador=NULL`, [id, valor, obs, req.usuario.id_usuario]);
    await db.execute(`INSERT INTO os_etapas(id_ocorrencia,codigo,titulo,concluida,id_responsavel,data_conclusao) VALUES(?,'orcamento','Orçamento elaborado',1,?,NOW()) ON DUPLICATE KEY UPDATE concluida=1,id_responsavel=VALUES(id_responsavel),data_conclusao=NOW()`, [id, req.usuario.id_usuario]);
    await db.execute(`UPDATE os_etapas SET concluida=0,id_responsavel=NULL,data_conclusao=NULL WHERE id_ocorrencia=? AND codigo='aprovacao'`, [id]);
    await osEvento(id, req.usuario, 'orcamento', `Orçamento enviado para aprovação: R$ ${valor.toFixed(2)}`); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar orçamento.' }) }
});
app.put('/os/:id/orcamento/aprovacao', exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id), aprovado = req.body?.aprovado === true;
  try {
    const [r] = await db.execute('SELECT id_ocorrencia FROM os_orcamentos WHERE id_ocorrencia=?', [id]); if (!r.length) return res.status(404).json({ erro: 'Orçamento não encontrado.' });
    await db.execute('UPDATE os_orcamentos SET status=?,id_aprovador=? WHERE id_ocorrencia=?', [aprovado ? 'Aprovado' : 'Rejeitado', req.usuario.id_usuario, id]);
    await db.execute(`INSERT INTO os_etapas(id_ocorrencia,codigo,titulo,concluida,id_responsavel,data_conclusao) VALUES(?,'aprovacao','Orçamento aprovado',?,?,?) ON DUPLICATE KEY UPDATE concluida=VALUES(concluida),id_responsavel=VALUES(id_responsavel),data_conclusao=VALUES(data_conclusao)`, [id, aprovado ? 1 : 0, aprovado ? req.usuario.id_usuario : null, aprovado ? new Date() : null]);
    await osEvento(id, req.usuario, 'aprovacao', aprovado ? 'Orçamento aprovado' : 'Orçamento rejeitado'); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao avaliar orçamento.' }) }
});
app.put('/os/:id/relatorio', exigirAutenticacao, osBloquearEncerrada, async (req, res) => {
  const id = Number(req.params.id), atividades = String(req.body?.atividades || '').trim(), materiais = String(req.body?.materiais || '').trim(), observacoes = String(req.body?.observacoes || '').trim();
  if (!atividades || atividades.length > 5000 || materiais.length > 5000 || observacoes.length > 5000) return res.status(400).json({ erro: 'Preencha atividades e materiais (máximo 5000 caracteres).' });
  try {
    if (!await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Sem acesso.' });
    await db.execute(`INSERT INTO os_relatorios(id_ocorrencia,atividades,materiais,observacoes,id_autor) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE atividades=VALUES(atividades),materiais=VALUES(materiais),observacoes=VALUES(observacoes),id_autor=VALUES(id_autor)`, [id, atividades, materiais, observacoes, req.usuario.id_usuario]);
    await db.execute(`INSERT INTO os_etapas(id_ocorrencia,codigo,titulo,concluida,id_responsavel,data_conclusao) VALUES(?,'relatorio','Relatório técnico finalizado',1,?,NOW()) ON DUPLICATE KEY UPDATE concluida=1,id_responsavel=VALUES(id_responsavel),data_conclusao=NOW()`, [id, req.usuario.id_usuario]);
    await osEvento(id, req.usuario, 'relatorio', 'Relatório técnico registrado/atualizado'); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao salvar relatório.' }) }
});
app.post('/os/:id/anexos', exigirAutenticacao, osBloquearEncerrada, (req, res, next) => {
  osUpload.single('arquivo')(req, res, e => e ? res.status(400).json({ erro: e.message }) : next());
}, async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (!req.file) return res.status(400).json({ erro: 'Selecione um arquivo.' });
    if (!await osPermissao(id, req.usuario)) { unlinkSync(req.file.path); return res.status(403).json({ erro: 'Sem acesso.' }) }
    await db.execute('INSERT INTO os_anexos(id_ocorrencia,id_usuario,nome_original,nome_arquivo,tipo_mime) VALUES(?,?,?,?,?)', [id, req.usuario.id_usuario, req.file.originalname.slice(0, 255), req.file.filename, req.file.mimetype]);
    await osEvento(id, req.usuario, 'anexo', `Anexo enviado: ${req.file.originalname.slice(0, 150)}`); res.status(201).json({ ok: true });
  } catch (e) { if (req.file?.path) try { unlinkSync(req.file.path) } catch { }; console.error(e); res.status(500).json({ erro: 'Erro ao anexar arquivo.' }) }
});
app.get('/os/:id/anexos/:anexo', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id), anexo = Number(req.params.anexo);
  try {
    if (!await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Sem acesso.' });
    const [r] = await db.execute('SELECT nome_arquivo,nome_original,tipo_mime FROM os_anexos WHERE id_ocorrencia=? AND id_anexo=?', [id, anexo]);
    if (!r.length) return res.status(404).json({ erro: 'Anexo não encontrado.' });
    res.type(r[0].tipo_mime); res.setHeader('Content-Disposition', `attachment; filename="anexo-${anexo}"`); res.sendFile(path.join(osDir, r[0].nome_arquivo));
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao baixar anexo.' }) }
});
app.post('/os/:id/conclusao', exigirAutenticacao, osBloquearEncerrada, async (req, res) => {
  const id = Number(req.params.id), obs = String(req.body?.observacao || '').trim();
  if (!obs || obs.length > 3000) return res.status(400).json({ erro: 'Descreva o serviço concluído.' });
  try {
    if (osAdmin(req.usuario) || !await osPermissao(id, req.usuario)) return res.status(403).json({ erro: 'Somente a equipe pode solicitar conclusão.' });
    const [etapas] = await db.execute(`SELECT codigo,concluida FROM os_etapas WHERE id_ocorrencia=?`, [id]);
    if (!['vistoria', 'orcamento', 'aprovacao', 'execucao', 'relatorio'].every(c => etapas.some(e => e.codigo === c && e.concluida))) return res.status(409).json({ erro: 'Conclua vistoria, orçamento aprovado, execução e relatório antes de solicitar.' });
    await db.execute(`INSERT INTO os_conclusoes(id_ocorrencia,status,id_solicitante,observacao) VALUES(?,'Solicitada',?,?) ON DUPLICATE KEY UPDATE status='Solicitada',id_solicitante=VALUES(id_solicitante),id_administrador=NULL,observacao=VALUES(observacao)`, [id, req.usuario.id_usuario, obs]);
    await osEvento(id, req.usuario, 'conclusao', 'Conclusão solicitada: ' + obs); res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao solicitar conclusão.' }) }
});
app.put('/os/:id/conclusao', exigirAdministrador, async (req, res) => {
  const id = Number(req.params.id), aprovado = req.body?.aprovado === true, obs = String(req.body?.observacao || '').trim();
  if (obs.length > 3000) return res.status(400).json({ erro: 'Observação muito longa.' });
  const cx = await db.getConnection();
  try {
    await cx.beginTransaction(); const [r] = await cx.execute('SELECT status FROM os_conclusoes WHERE id_ocorrencia=? FOR UPDATE', [id]);
    if (r[0]?.status !== 'Solicitada') { await cx.rollback(); return res.status(409).json({ erro: 'Não há solicitação pendente.' }) }
    await cx.execute('UPDATE os_conclusoes SET status=?,id_administrador=?,observacao=? WHERE id_ocorrencia=?', [aprovado ? 'Aprovada' : 'Rejeitada', req.usuario.id_usuario, obs, id]);
    await cx.execute(`INSERT INTO os_etapas(id_ocorrencia,codigo,titulo,concluida,id_responsavel,data_conclusao) VALUES(?,'encerramento','Atendimento encerrado',?,?,?) ON DUPLICATE KEY UPDATE concluida=VALUES(concluida),id_responsavel=VALUES(id_responsavel),data_conclusao=VALUES(data_conclusao)`, [id, aprovado ? 1 : 0, aprovado ? req.usuario.id_usuario : null, aprovado ? new Date() : null]);
    if (aprovado) { const [old] = await cx.execute('SELECT status FROM ocorrencias WHERE id_ocorrencia=?', [id]); await cx.execute("UPDATE ocorrencias SET status='Resolvida' WHERE id_ocorrencia=?", [id]); await cx.execute(`INSERT INTO historico_ocorrencias(id_ocorrencia,id_usuario,status_anterior,novo_status,observacao) VALUES(?, ?, ?, 'Resolvida', ?)`, [id, req.usuario.id_usuario, old[0]?.status || 'Em atendimento', obs || 'Serviço validado pelo administrador']); }
    await cx.commit(); await osEvento(id, req.usuario, 'conclusao', aprovado ? 'Conclusão aprovada pelo administrador' : 'Conclusão rejeitada: ' + obs); res.json({ ok: true });
  } catch (e) { await cx.rollback(); console.error(e); res.status(500).json({ erro: 'Erro ao validar conclusão.' }) } finally { cx.release() }
});

app.get('/minhas-tarefas', exigirAutenticacao, async (req, res) => {
  const admin = req.usuario.perfil === 'Administrador';
  if (!admin && req.usuario.tipo_usuario !== 'Funcionário') return res.status(403).json({ erro: 'Acesso restrito à equipe.' });
  try {
    const [rows] = await db.execute(`SELECT DISTINCT o.id_ocorrencia,o.titulo,o.descricao,o.prioridade,o.status,o.data_registro,
      e.nome AS equipe_nome,c.nome AS categoria,l.endereco,l.bairro,l.cidade
      FROM atribuicoes_equipes a JOIN ocorrencias o ON o.id_ocorrencia=a.id_ocorrencia
      JOIN equipes e ON e.id_equipe=a.id_equipe
      LEFT JOIN categorias c ON c.id_categoria=o.id_categoria
      LEFT JOIN localizacoes l ON l.id_ocorrencia=o.id_ocorrencia
      WHERE a.data_encerramento IS NULL ${admin ? '' : 'AND a.id_equipe=?'}
      ORDER BY o.data_registro DESC`, admin ? [] : [req.usuario.id_equipe]);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao consultar tarefas da equipe.' }); }
});
app.post('/minhas-tarefas/:id/atualizacao', exigirAutenticacao, async (req, res) => {
  const id = Number(req.params.id);
  const acao = String(req.body?.acao || '');
  const observacao = String(req.body?.observacao || '').trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !['iniciar', 'atualizar', 'solicitar_conclusao'].includes(acao) || !observacao || observacao.length > 1500)
    return res.status(400).json({ erro: 'Informe ação válida e observação de até 1500 caracteres.' });
  if (req.usuario.tipo_usuario !== 'Funcionário') return res.status(403).json({ erro: 'Apenas funcionários.' });
  const cx = await db.getConnection();
  try {
    await cx.beginTransaction();
    const [rows] = await cx.execute(`SELECT o.status FROM ocorrencias o JOIN atribuicoes_equipes a ON a.id_ocorrencia=o.id_ocorrencia
      JOIN usuarios u ON u.id_equipe=a.id_equipe
      WHERE o.id_ocorrencia=? AND u.id_usuario=? AND a.data_encerramento IS NULL FOR UPDATE`, [id, req.usuario.id_usuario]);
    if (!rows.length) { await cx.rollback(); return res.status(403).json({ erro: 'Tarefa não atribuída a você.' }); }
    const anterior = rows[0].status;
    const novo = acao === 'iniciar' ? 'Em atendimento' : acao === 'solicitar_conclusao' ? 'Aguardando retorno' : anterior;
    if (novo !== anterior) await cx.execute('UPDATE ocorrencias SET status=? WHERE id_ocorrencia=?', [novo, id]);
    await cx.execute(`INSERT INTO historico_ocorrencias
      (id_ocorrencia,id_usuario,status_anterior,novo_status,observacao) VALUES (?,?,?,?,?)`,
      [id, req.usuario.id_usuario, anterior, novo, `${acao}: ${observacao}`]);
    await cx.commit();
    if (acao === 'solicitar_conclusao') {
      const [admins] = await db.execute("SELECT id_usuario FROM usuarios WHERE perfil='Administrador' AND status='Ativo'");
      await Promise.all(admins.map(a => notificarServico(a.id_usuario, id, `Conclusão solicitada na ocorrência #${id}.`)));
    }
    res.json({ mensagem: 'Atualização registrada.', status: novo });
  } catch (e) { await cx.rollback(); console.error(e); res.status(500).json({ erro: 'Erro ao registrar atualização.' }); }
  finally { cx.release(); }
});
app.get('/minhas-notificacoes', exigirAutenticacao, async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT id_notificacao,id_ocorrencia,mensagem,lida,data_notificacao
    FROM notificacoes WHERE id_usuario=? ORDER BY data_notificacao DESC LIMIT 100`, [req.usuario.id_usuario]); res.json(rows);
  }
  catch (e) { console.error(e); res.status(500).json({ erro: 'Erro ao buscar notificações.' }); }
});
app.put('/minhas-notificacoes/:id/lida', exigirAutenticacao, async (req, res) => {
  try { await db.execute('UPDATE notificacoes SET lida=1 WHERE id_notificacao=? AND id_usuario=?', [req.params.id, req.usuario.id_usuario]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ erro: 'Erro ao marcar notificação.' }); }
});

app.get("/ocorrencias/:id", async (req, res) => {
  try {
    const ocorrencia = await buscarOcorrenciaPorId(Number(req.params.id));

    if (!ocorrencia) {
      return res.status(404).json({
        erro: "Ocorrência não encontrada.",
      });
    }

    return res.json(ocorrencia);
  } catch (erro) {
    console.error("Erro ao buscar ocorrência:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar ocorrência.",
    });
  }
});
// Cadastro com transação: ocorrência e endereço são salvos juntos.
app.post(
  "/ocorrencias",

  exigirAutenticacao,

  exigirAdministrador,

  async (req, res) => {
    const {
      id_categoria,

      titulo,

      descricao,

      prioridade,

      endereco,

      bairro,

      cidade,
    } = req.body || {};

    const categoria = Number(id_categoria);

    if (
      !Number.isInteger(categoria) ||
      categoria <= 0 ||
      !String(titulo || "").trim() ||
      !String(endereco || "").trim() ||
      !String(descricao || "").trim() ||
      !["Alta", "Média", "Baixa"].includes(prioridade)
    ) {
      return res

        .status(400)

        .json({
          erro: "Preencha categoria, título, endereço, descrição e prioridade válidos.",
        });
    }

    const conexao = await db.getConnection();

    try {
      await conexao.beginTransaction();

      const [categorias] = await conexao.execute(
        "SELECT id_categoria FROM categorias WHERE id_categoria = ?",

        [categoria],
      );

      if (!categorias.length) {
        await conexao.rollback();

        return res.status(400).json({ erro: "Categoria não encontrada." });
      }

      const [resultado] = await conexao.execute(
        `INSERT INTO ocorrencias (id_usuario, id_categoria, titulo, descricao, prioridade, status)

             VALUES (?, ?, ?, ?, ?, 'Aberta')`,

        [
          req.usuario.id_usuario,

          categoria,

          titulo.trim(),

          descricao.trim(),

          prioridade,
        ],
      );

      await conexao.execute(
        `INSERT INTO localizacoes (id_ocorrencia, endereco, bairro, cidade) VALUES (?, ?, ?, ?)`,

        [
          resultado.insertId,

          endereco.trim(),

          String(bairro || "Não informado").trim() || "Não informado",

          String(cidade || "Criciúma").trim() || "Criciúma",
        ],
      );

      await conexao.commit();
      agendarAnaliseDenuncia(resultado.insertId);
      try {
        const [admins] = await db.execute("SELECT id_usuario FROM usuarios WHERE perfil='Administrador' AND status='Ativo'");
        await Promise.all(admins.map(a => notificarServico(a.id_usuario, resultado.insertId, `Nova denúncia #${resultado.insertId}: ${String(titulo).slice(0, 100)}`)));
      } catch (e) { console.error('Aviso de nova denúncia:', e.message); }

      return res

        .status(201)

        .json({
          mensagem: "Ocorrência criada com sucesso!",

          id_ocorrencia: resultado.insertId,
        });
    } catch (erro) {
      await conexao.rollback();

      console.error("Erro ao criar ocorrência:", erro);

      return res

        .status(500)

        .json({ erro: "Erro ao salvar ocorrência e localização no banco." });
    } finally {
      conexao.release();
    }
  },
);

app.put("/ocorrencias/:id", exigirAcessoOcorrencia, async (req, res) => {
  try {
    const resultado = await atualizarOcorrencia(
      Number(req.params.id),

      req.body,
    );

    if (!resultado)
      return res.status(404).json({ erro: "Ocorrência não encontrada." });

    return res.json({ mensagem: "Ocorrência atualizada.", resultado });
  } catch (erro) {
    console.error("Erro ao atualizar ocorrência:", erro);

    return res.status(500).json({
      erro: "Erro ao atualizar ocorrência.",
    });
  }
});

app.delete("/ocorrencias/:id", exigirAdministrador, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ erro: "ID inválido." });
    const resultado = await excluirOcorrencia(id);
    if (!resultado.affectedRows) return res.status(404).json({ erro: "Ocorrência não encontrada." });
    return res.json({
      mensagem: "Ocorrência excluída.",
    });
  } catch (erro) {
    console.error("Erro ao excluir ocorrência:", erro);

    return res.status(500).json({
      erro: "Erro ao excluir ocorrência.",
    });
  }
});
// ======================================================// EQUIPES// ======================================================
app.get("/equipes", async (req, res) => {
  try {
    return res.json(await listarEquipes());
  } catch (erro) {
    console.error("Erro ao buscar equipes:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar equipes.",
    });
  }
});
// ======================================================// NOTAS// ======================================================
app.get("/usuarios/:id/notas", async (req, res) => {
  try {
    return res.json(await listarNotasDoUsuario(Number(req.params.id)));
  } catch (erro) {
    console.error("Erro ao buscar notas:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar notas.",
    });
  }
});

app.post("/notas", async (req, res) => {
  try {
    const {
      id_usuario,

      titulo,

      conteudo,

      tipo,
    } = req.body || {};

    if (!id_usuario || !titulo?.trim?.() || !conteudo?.trim?.()) {
      return res.status(400).json({
        erro: "Informe usuário, título e conteúdo.",
      });
    }

    const resultado = await criarNotaBD({
      id_usuario,

      titulo: titulo.trim(),

      conteudo: conteudo.trim(),

      tipo,
    });

    return res.status(201).json({
      mensagem: "Nota criada.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao criar nota:", erro);

    return res.status(500).json({
      erro: "Erro ao criar nota.",
    });
  }
});

app.delete("/notas/:id", async (req, res) => {
  try {
    const removidas = await excluirNotaBD(
      Number(req.params.id),

      req.query.id_usuario,
    );

    if (!removidas) {
      return res.status(404).json({
        erro: "Nota não encontrada.",
      });
    }

    return res.json({
      mensagem: "Nota excluída.",
    });
  } catch (erro) {
    console.error("Erro ao excluir nota:", erro);

    return res.status(500).json({
      erro: "Erro ao excluir nota.",
    });
  }
});
// ======================================================// LOCALIZAÇÕES// ======================================================
app.get("/localizacoes", async (req, res) => {
  try {
    return res.json(await listarLocalizacoes());
  } catch (erro) {
    console.error("Erro ao buscar localizações:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar localizações.",
    });
  }
});

app.get("/localizacoes/:idOcorrencia", async (req, res) => {
  try {
    const localizacao = await buscarLocalizacao(
      Number(req.params.idOcorrencia),
    );

    if (!localizacao) {
      return res.status(404).json({
        erro: "Localização não encontrada.",
      });
    }

    return res.json(localizacao);
  } catch (erro) {
    console.error("Erro ao buscar localização:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar localização.",
    });
  }
});

app.post("/localizacoes", async (req, res) => {
  try {
    const resultado = await criarLocalizacao(req.body);

    return res.status(201).json({
      mensagem: "Localização cadastrada.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao cadastrar localização:", erro);

    return res.status(500).json({
      erro: "Erro ao cadastrar localização.",
    });
  }
});
// ======================================================// HISTÓRICO DAS OCORRÊNCIAS// ======================================================
app.get("/ocorrencias/:id/historico", async (req, res) => {
  try {
    return res.json(await listarHistorico(Number(req.params.id)));
  } catch (erro) {
    console.error("Erro ao buscar histórico:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar histórico.",
    });
  }
});

app.post("/historico", async (req, res) => {
  try {
    const resultado = await criarHistorico(req.body);

    return res.status(201).json({
      mensagem: "Histórico registrado.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao registrar histórico:", erro);

    return res.status(500).json({
      erro: "Erro ao registrar histórico.",
    });
  }
});
// ======================================================// ATENDIMENTOS// ======================================================
app.get("/ocorrencias/:id/atendimentos", async (req, res) => {
  try {
    return res.json(await listarAtendimentos(Number(req.params.id)));
  } catch (erro) {
    console.error("Erro ao buscar atendimentos:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar atendimentos.",
    });
  }
});

app.post("/atendimentos", async (req, res) => {
  try {
    const resultado = await criarAtendimento(req.body);

    return res.status(201).json({
      mensagem: "Atendimento criado.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao criar atendimento:", erro);

    return res.status(500).json({
      erro: "Erro ao criar atendimento.",
    });
  }
});
// ======================================================// NOTIFICAÇÕES// ======================================================
app.get("/usuarios/:id/notificacoes", exigirAutenticacao, async (req, res) => {
  if (Number(req.params.id) !== req.usuario.id_usuario && req.usuario.perfil !== "Administrador") return res.status(403).json({ erro: "Sem permissão." });
  try {
    return res.json(await listarNotificacoes(Number(req.params.id)));
  } catch (erro) {
    console.error("Erro ao buscar notificações:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar notificações.",
    });
  }
});

app.post("/notificacoes", exigirAdministrador, async (req, res) => {
  try {
    const resultado = await criarNotificacao(req.body);

    return res.status(201).json({
      mensagem: "Notificação criada.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao criar notificação:", erro);

    return res.status(500).json({
      erro: "Erro ao criar notificação.",
    });
  }
});

app.put("/notificacoes/:id/lida", exigirAutenticacao, async (req, res) => {
  return res.status(410).json({ erro: "Use /minhas-notificacoes/:id/lida." });
  try {
    await marcarComoLida(Number(req.params.id));

    return res.json({
      mensagem: "Notificação marcada como lida.",
    });
  } catch (erro) {
    console.error("Erro ao atualizar notificação:", erro);

    return res.status(500).json({
      erro: "Erro ao atualizar notificação.",
    });
  }
});
// ======================================================// ANEXOS// ======================================================
app.get("/ocorrencias/:id/anexos", async (req, res) => {
  try {
    return res.json(await listarAnexos(Number(req.params.id)));
  } catch (erro) {
    console.error("Erro ao buscar anexos:", erro);

    return res.status(500).json({
      erro: "Erro ao buscar anexos.",
    });
  }
});

app.post("/anexos", async (req, res) => {
  try {
    const resultado = await criarAnexo(req.body);

    return res.status(201).json({
      mensagem: "Anexo registrado.",

      ...resultado,
    });
  } catch (erro) {
    console.error("Erro ao registrar anexo:", erro);

    return res.status(500).json({
      erro: "Erro ao registrar anexo.",
    });
  }
});
// ======================================================// DENÚNCIAS// Aceita o formulário antigo e o formulário público.// ======================================================
// Consulta de geocodificação sob demanda. Sem chave paga.
// O serviço público Nominatim exige baixo volume: cache + intervalo mínimo de 1 segundo.
const cacheGeocodificacao = new Map();
let ultimaConsultaGeocodificacao = 0;
let filaGeocodificacao = Promise.resolve();

function consultarGeocodificacaoEmFila(tarefa) {
  const proxima = filaGeocodificacao.catch(() => { }).then(async () => {
    const espera = Math.max(0, 1100 - (Date.now() - ultimaConsultaGeocodificacao));
    if (espera) await new Promise(resolve => setTimeout(resolve, espera));
    ultimaConsultaGeocodificacao = Date.now();
    return tarefa();
  });
  filaGeocodificacao = proxima.catch(() => { });
  return proxima;
}

app.post("/geocodificar-endereco", async (req, res) => {
  const rua = String(req.body?.rua || "").trim().slice(0, 150);
  const bairro = String(req.body?.bairro || "").trim().slice(0, 100);
  const cidade = String(req.body?.cidade || "").trim().slice(0, 100);
  const cep = String(req.body?.cep || "").replace(/\D/g, "").slice(0, 8);
  if (rua.length < 5 || bairro.length < 2 || cidade.length < 2) {
    return res.status(400).json({ erro: "Informe rua, bairro e cidade completos." });
  }
  const chave = [rua, bairro, cidade, cep].join("|").toLowerCase();
  const anterior = cacheGeocodificacao.get(chave);
  if (anterior && Date.now() - anterior.criado < 86400000) return res.json(anterior.valor);
  try {
    // Faz consultas progressivas, sem assumir que o CEP ou o bairro constem no OSM.
    // Mantém o limite de uma consulta por segundo do Nominatim.
    const ruaSemNumero = rua.replace(/,?\s+(?:n[º°o.]?\s*)?\d+.*$/i, "").trim();
    const buscas = [
      [ruaSemNumero, bairro, cidade, "Santa Catarina", "Brasil"],
      [ruaSemNumero, cidade, "Santa Catarina", "Brasil"],
    ];
    let resultado = [];
    for (const partes of buscas) {
      const itens = await consultarGeocodificacaoEmFila(async () => {
        const params = new URLSearchParams({
          q: partes.filter(Boolean).join(", "),
          format: "jsonv2", addressdetails: "1", limit: "10", countrycodes: "br"
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        try {
          const resposta = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "NexBuild-ProjetoEducacional/1.0 (configure-contato@exemplo.com)", "Accept-Language": "pt-BR" },
            signal: controller.signal
          });
          if (!resposta.ok) throw new Error("Serviço de localização indisponível.");
          return resposta.json();
        } finally { clearTimeout(timeout); }
      });
      resultado.push(...(Array.isArray(itens) ? itens : []));
    }
    const normalizar = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const cidadeEsperada = normalizar(cidade);
    const ruaEsperada = normalizar(ruaSemNumero).replace(/^(avenida|av\.?|rua|r\.?)\s+/, "").trim();
    const itens = Array.isArray(resultado) ? resultado : [];
    const escolhido = itens.find(item => {
      const a = item.address || {};
      const cidadeRetornada = normalizar(a.city || a.town || a.municipality || a.village);
      const ruaRetornada = normalizar(a.road || a.pedestrian || a.residential || a.street).replace(/^(avenida|av\.?|rua|r\.?)\s+/, "").trim();
      return cidadeRetornada === cidadeEsperada && ruaRetornada &&
        (ruaEsperada.includes(ruaRetornada) || ruaRetornada.includes(ruaEsperada));
    });
    if (!escolhido) return res.status(404).json({ erro: "Rua não encontrada com confiança. Escolha o ponto diretamente no mapa do formulário." });
    const latitude = Number(escolhido.lat);
    const longitude = Number(escolhido.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("Coordenadas inválidas.");
    const valor = { latitude, longitude, endereco_encontrado: escolhido.display_name };
    if (cacheGeocodificacao.size > 300) cacheGeocodificacao.clear();
    cacheGeocodificacao.set(chave, { criado: Date.now(), valor });
    return res.json(valor);
  } catch (erro) {
    console.error("Geocodificação:", erro);
    return res.status(503).json({ erro: "Não foi possível consultar o endereço agora. Tente novamente ou use o GPS." });
  }
});

// GPS -> endereço. Não supõe que o ponto retornado seja o local do problema.
app.post("/geocodificar-reverso", async (req, res) => {
  const latitude = Number(req.body?.latitude);
  const longitude = Number(req.body?.longitude);
  if (req.body?.latitude == null || req.body?.longitude == null ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(400).json({ erro: "Coordenadas inválidas." });
  }
  try {
    const resultado = await consultarGeocodificacaoEmFila(async () => {
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude), format: "jsonv2", addressdetails: "1", zoom: "18" });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const resposta = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
          headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "NexBuild-ProjetoEducacional/1.0 (configure-contato@exemplo.com)", "Accept-Language": "pt-BR" },
          signal: controller.signal
        });
        if (!resposta.ok) throw new Error("Serviço de endereço indisponível.");
        return resposta.json();
      } finally { clearTimeout(timeout); }
    });
    const a = resultado.address || {};
    return res.json({
      cidade: a.city || a.town || a.municipality || a.village || "",
      bairro: a.suburb || a.neighbourhood || a.city_district || a.quarter || "",
      rua: [a.road || a.pedestrian || a.residential || a.street || "", a.house_number || ""].filter(Boolean).join(", "),
      endereco_encontrado: resultado.display_name || "",
      latitude, longitude
    });
  } catch (erro) {
    console.error("Geocodificação reversa:", erro);
    return res.status(503).json({ erro: "Não foi possível identificar o endereço pelo GPS. Preencha manualmente." });
  }
});

// Limite simples por origem. Em produção com múltiplas instâncias, use Redis.
const tentativasDenuncia = new Map();
const JANELA_DENUNCIA_MS = 10 * 60 * 1000;
const MAX_DENUNCIAS_JANELA = 3;
function limitarDenuncias(req, res, next) {
  const agora = Date.now();
  const origem = req.ip || req.socket.remoteAddress || "desconhecida";
  if (tentativasDenuncia.size > 5000) {
    for (const [chave, entradas] of tentativasDenuncia) {
      const recentes = entradas.filter((t) => agora - t < JANELA_DENUNCIA_MS);
      if (recentes.length) tentativasDenuncia.set(chave, recentes);
      else tentativasDenuncia.delete(chave);
    }
  }
  const recentes = (tentativasDenuncia.get(origem) || []).filter((t) => agora - t < JANELA_DENUNCIA_MS);
  if (recentes.length >= MAX_DENUNCIAS_JANELA) {
    return res.status(429).json({ erro: "Muitas denúncias em pouco tempo. Aguarde alguns minutos e tente novamente." });
  }
  // Conta tentativas, não apenas envios bem-sucedidos, para reduzir abuso.
  recentes.push(agora);
  tentativasDenuncia.set(origem, recentes);
  next();
}

app.post("/denuncia", limitarDenuncias, async (req, res) => {
  const body = req.body || {};

  // Rota pública: nunca confiar em id_usuario enviado pelo navegador.
  // Denúncias identificadas por conta exigem autenticação validada no servidor.
  const usuarioId = null;

  const categoriaNome = String(body.categoria || "").trim();

  const categoriaRaw = body.id_categoria ?? null;

  const descricao = String(body.descricao || "").trim();

  const cidade = String(body.cidade || "").trim();

  const bairro = String(body.bairro || "").trim();

  const rua =
    String(body.rua || body.endereco || "Não informado").trim() ||
    "Não informado";

  const titulo = String(
    body.titulo ||
    `${categoriaNome || "Relato cidadão"}: ${descricao.slice(0, 90)}`,
  ).trim();

  const gravidadeBruta = String(body.gravidade || body.prioridade || "media")
    .trim()

    .toLowerCase();

  const prioridades = {
    baixa: "Baixa",

    media: "Média",

    média: "Média",

    alta: "Alta",
  };

  const prioridade = prioridades[gravidadeBruta] || "Média";

  const latitudeInformada = body.latitude;
  const longitudeInformada = body.longitude;
  const latitude = Number(latitudeInformada);
  const longitude = Number(longitudeInformada);
  if (latitudeInformada == null || longitudeInformada == null ||
    latitudeInformada === "" || longitudeInformada === "" ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return res.status(422).json({ erro: "Confirme a localização pelo endereço ou GPS antes de enviar." });
  }


  if (
    (usuarioId !== null && (!Number.isInteger(usuarioId) || usuarioId <= 0)) ||
    !titulo ||
    titulo.length > 180 ||
    descricao.length < 10 ||
    descricao.length > 5000 ||
    !cidade || cidade.length > 150 ||
    !bairro || bairro.length > 150 ||
    !rua || rua === "Não informado" || rua.length > 200 ||
    categoriaNome.length > 120 ||
    (!categoriaNome && !categoriaRaw)
  ) {
    return res.status(400).json({
      erro: "Informe categoria, título, descrição (10 a 5000 caracteres), cidade, bairro e rua válidos.",
    });
  }

  try {
    if (usuarioId !== null) {
      const [usuarios] = await db.execute(
        `SELECT id_usuario



                 FROM usuarios



                 WHERE id_usuario = ?



                   AND status = 'Ativo'



                 LIMIT 1`,

        [usuarioId],
      );

      if (!usuarios.length) {
        return res.status(400).json({
          erro: "Usuário inexistente ou inativo.",
        });
      }
    }

    let categoriaId = Number(categoriaRaw);

    if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
      const [encontradas] = await db.execute(
        `SELECT id_categoria



                 FROM categorias



                 WHERE nome = ?



                 LIMIT 1`,

        [categoriaNome],
      );

      if (encontradas.length) {
        categoriaId = encontradas[0].id_categoria;
      } else {
        const [nova] = await db.execute(
          `INSERT INTO categorias (nome, descricao)



                     VALUES (?, ?)`,

          [
            categoriaNome,

            "Categoria criada pelo formulário público de denúncias",
          ],
        );

        categoriaId = nova.insertId;
      }
    } else {
      const categoria = await buscarCategoriaPorId(categoriaId);

      if (!categoria) {
        return res.status(400).json({
          erro: "A categoria informada não existe.",
        });
      }
    }

    const resultado = await criarOcorrencia({
      id_usuario: usuarioId,

      id_categoria: categoriaId,

      titulo,

      descricao,

      prioridade,
    });

    const idOcorrencia = resultado.id_ocorrencia;

    if (!idOcorrencia) {
      throw new Error("A criação da ocorrência não retornou id_ocorrencia.");
    }

    await criarLocalizacao({
      id_ocorrencia: idOcorrencia,

      endereco: rua,

      bairro,

      cidade,

      latitude,

      longitude,
    });

    // Executa após salvar: uma falha do Ollama nunca impede o cadastro.
    agendarAnaliseDenuncia(idOcorrencia);
    try {
      const [admins] = await db.execute("SELECT id_usuario FROM usuarios WHERE perfil='Administrador' AND status='Ativo'");
      await Promise.all(admins.map(a => notificarServico(a.id_usuario, idOcorrencia, `Nova denúncia #${idOcorrencia}: ${titulo.slice(0, 100)}`)));
    } catch (e) { console.error('Notificação de nova denúncia:', e.message); }

    return res.status(201).json({
      mensagem: "Denúncia registrada com sucesso.",

      id_ocorrencia: idOcorrencia,

      protocolo: `NX-${String(idOcorrencia).padStart(6, "0")}`,
    });
  } catch (erro) {
    console.error("Erro ao registrar denúncia:", erro);

    return res.status(500).json({
      erro: "Não foi possível registrar a denúncia. Confira o banco de dados e os módulos de ocorrências e localizações.",
    });
  }
});
// Perfil próprio: não permite alterar cargo, setor, tipo ou permissões.
app.get("/me", exigirAutenticacao, async (req, res) => {
  try {
    const [linhas] = await db.execute(
      "SELECT id_usuario, nome, email, cargo, setor, id_equipe, perfil, tipo_usuario, status FROM usuarios WHERE id_usuario = ? LIMIT 1",
      [req.usuario.id_usuario]
    );
    if (!linhas.length) return res.status(404).json({ erro: "Usuário não encontrado." });
    res.json(linhas[0]);
  } catch (erro) {
    console.error("Erro em /me:", erro);
    res.status(500).json({ erro: "Erro ao carregar o perfil." });
  }
});
app.put("/me", exigirAutenticacao, async (req, res) => {
  const { nome, email } = req.body || {};
  if (typeof nome !== "string" || !nome.trim() || nome.trim().length > 100 ||
    typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 100) {
    return res.status(400).json({ erro: "Nome ou e-mail inválido." });
  }
  try {
    await db.execute("UPDATE usuarios SET nome = ?, email = ? WHERE id_usuario = ?",
      [nome.trim(), email.trim().toLowerCase(), req.usuario.id_usuario]);
    const [linhas] = await db.execute(
      "SELECT id_usuario, nome, email, cargo, setor, perfil, tipo_usuario, status FROM usuarios WHERE id_usuario = ?",
      [req.usuario.id_usuario]);
    res.json({ usuario: linhas[0] });
  } catch (erro) {
    if (erro.code === "ER_DUP_ENTRY") return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    console.error("Erro ao atualizar perfil:", erro);
    res.status(500).json({ erro: "Erro ao atualizar perfil." });
  }
});
// ======================================================// PREFERÊNCIAS DOS USUÁRIOS// ======================================================
app.get(
  "/usuarios/:id/preferencias",
  exigirAutenticacao,
  async (req, res) => {
    const id = Number(req.params.id);
    if (id !== req.usuario.id_usuario) return res.status(403).json({ erro: "Acesso negado às preferências de outro usuário." });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        erro: "ID inválido.",
      });
    }

    try {
      const [usuarios] = await db.execute(
        `SELECT id_usuario



                 FROM usuarios



                 WHERE id_usuario = ?



                 LIMIT 1`,

        [id],
      );

      if (!usuarios.length) {
        return res.status(404).json({
          erro: "Usuário não encontrado.",
        });
      }

      const [linhas] = await db.execute(
        `SELECT notificacoes, alertas_urgentes
           FROM preferencias_usuarios
           WHERE id_usuario = ? LIMIT 1`,
        [id],
      );

      if (!linhas.length) {
        await db.execute(
          `INSERT INTO preferencias_usuarios



                        (id_usuario, notificacoes, alertas_urgentes)



                     VALUES (?, 1, 1)`,

          [id],
        );

        return res.json({
          notificacoes: true,

          alertasUrgentes: true,
        });
      }

      return res.json({
        notificacoes: Boolean(linhas[0].notificacoes),

        alertasUrgentes: Boolean(linhas[0].alertas_urgentes),
      });
    } catch (erro) {
      console.error("Erro ao buscar preferências:", erro);

      return res.status(500).json({
        erro: "Erro ao buscar preferências.",
      });
    }
  },
);

app.put(
  "/usuarios/:id/preferencias",
  exigirAutenticacao,
  async (req, res) => {
    const id = Number(req.params.id);
    if (id !== req.usuario.id_usuario) return res.status(403).json({ erro: "Acesso negado às preferências de outro usuário." });

    const {
      notificacoes,

      alertasUrgentes,
    } = req.body || {};

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      typeof notificacoes !== "boolean" ||
      typeof alertasUrgentes !== "boolean"
    ) {
      return res.status(400).json({
        erro: "Dados inválidos.",
      });
    }

    try {
      await db.execute(
        `INSERT INTO preferencias_usuarios



                    (id_usuario, notificacoes, alertas_urgentes)



                 VALUES (?, ?, ?)



                 ON DUPLICATE KEY UPDATE



                    notificacoes = VALUES(notificacoes),



                    alertas_urgentes = VALUES(alertas_urgentes)`,

        [id, Number(notificacoes), Number(alertasUrgentes)],
      );

      return res.json({
        mensagem: "Preferências salvas com sucesso.",
      });
    } catch (erro) {
      console.error("Erro ao salvar preferências:", erro);

      return res.status(500).json({
        erro: "Erro ao salvar preferências.",
      });
    }
  },
);
// ======================================================// INICIALIZAÇÃO// ======================================================
const PORT = Number(process.env.PORT) || 3000;

async function prepararChatPrivado() {
  await db.execute(`CREATE TABLE IF NOT EXISTS mensagens_privadas (
    id_mensagem BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_remetente INT NOT NULL, id_destinatario INT NOT NULL,
    mensagem TEXT NOT NULL, data_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversa (id_remetente,id_destinatario,data_envio)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await db.execute(`CREATE TABLE IF NOT EXISTS notificacoes_chat (
    id_notificacao BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL, id_remetente INT NOT NULL,
    tipo ENUM('privada','canal') NOT NULL, canal VARCHAR(40) NULL,
    mensagem VARCHAR(500) NOT NULL, lida TINYINT(1) NOT NULL DEFAULT 0,
    data_notificacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_usuario (id_usuario,lida,data_notificacao)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

prepararTabelaChat()
  .then(prepararChatPrivado)
  .then(() => {
    servidorHttp.listen(PORT, () => {
      console.log(`Servidor rodando em http://localhost:${PORT}`);

      console.log(
        "Chat em tempo real preparado; tabela mensagens_chat verificada.",
      );
    });
  })

  .catch((erro) => {
    console.error(
      "Não foi possível preparar a tabela do chat. Confira o MySQL:",

      erro,
    );

    process.exit(1);
  });
