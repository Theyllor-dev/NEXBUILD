import bcrypt from "bcrypt";
import { db } from "./db.js";

const SALT_ROUNDS = 12;
const PERFIS = ["Usuário", "Administrador"];
const TIPOS_USUARIO = ["Cidadão", "Funcionário", "Administrador"];

const ehHashBcrypt = (valor) => /^\$2[aby]\$\d{2}\$/.test(valor || "");

function validarPermissoes(perfil, tipo_usuario) {
  if (!PERFIS.includes(perfil)) throw new Error("PERFIL_INVALIDO");
  if (!TIPOS_USUARIO.includes(tipo_usuario))
    throw new Error("TIPO_USUARIO_INVALIDO");
  if ((perfil === "Administrador") !== (tipo_usuario === "Administrador")) {
    throw new Error("PERMISSOES_INCONSISTENTES");
  }
}

function validarDadosUsuario({ nome, email, cargo, setor }) {
  if (
    typeof nome !== "string" ||
    !nome.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof cargo !== "string" ||
    !cargo.trim() ||
    typeof setor !== "string" ||
    !setor.trim()
  ) {
    throw new Error("DADOS_USUARIO_INVALIDOS");
  }
}

export async function criarUsuario({
  nome,
  email,
  senha,
  cargo = "Cidadão",
  setor = "Atendimento",
  perfil = "Usuário",
  tipo_usuario = "Cidadão",
}) {
  validarDadosUsuario({ nome, email, cargo, setor });
  if (typeof senha !== "string" || !senha) {
    throw new Error("DADOS_USUARIO_INVALIDOS");
  }
  validarPermissoes(perfil, tipo_usuario);

  const nomeNormalizado = nome.trim();
  const emailNormalizado = email.trim().toLowerCase();

  const [existentes] = await db.execute(
    "SELECT id_usuario FROM usuarios WHERE email = ? LIMIT 1",
    [emailNormalizado],
  );
  if (existentes.length) throw new Error("EMAIL_JA_CADASTRADO");

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
  const [resultado] = await db.execute(
    `INSERT INTO usuarios
      (nome, email, senha, cargo, setor, perfil, tipo_usuario, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'Ativo')`,
    [
      nomeNormalizado,
      emailNormalizado,
      senhaHash,
      cargo.trim(),
      setor.trim(),
      perfil,
      tipo_usuario,
    ],
  );
  return buscarUsuarioPorId(resultado.insertId);
}

export async function verificarLogin(email, senha) {
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof senha !== "string" ||
    !senha
  ) {
    return null;
  }
  const [usuarios] = await db.execute(
    `SELECT id_usuario, nome, email, senha, cargo, setor, perfil, tipo_usuario, status, data_cadastro
     FROM usuarios WHERE email = ? LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  if (!usuarios.length || usuarios[0].status !== "Ativo") return null;

  const usuario = usuarios[0];
  let senhaCorreta = false;
  if (ehHashBcrypt(usuario.senha)) {
    senhaCorreta = await bcrypt.compare(senha, usuario.senha);
  } else {
    // Compatibilidade temporária com senhas legadas em texto puro.
    senhaCorreta = usuario.senha === senha;
    if (senhaCorreta) {
      const novoHash = await bcrypt.hash(senha, SALT_ROUNDS);
      await db.execute("UPDATE usuarios SET senha = ? WHERE id_usuario = ?", [
        novoHash,
        usuario.id_usuario,
      ]);
    }
  }
  if (!senhaCorreta) return null;
  const { senha: _senhaOculta, ...usuarioPublico } = usuario;
  return usuarioPublico;
}

export async function listarUsuarios() {
  const [usuarios] = await db.execute(
    `SELECT id_usuario, nome, email, cargo, setor, id_equipe, perfil, tipo_usuario, status, data_cadastro
     FROM usuarios ORDER BY id_usuario DESC`,
  );
  return usuarios;
}

export async function buscarUsuarioPorId(id) {
  const idNormalizado = Number(id);
  if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) return null;
  const [usuarios] = await db.execute(
    `SELECT id_usuario, nome, email, cargo, setor, id_equipe, perfil, tipo_usuario, status, data_cadastro
     FROM usuarios WHERE id_usuario = ? LIMIT 1`,
    [idNormalizado],
  );
  return usuarios[0] || null;
}

export async function atualizarUsuario(
  id,
  { nome, email, cargo, setor, perfil, tipo_usuario },
) {
  const idNormalizado = Number(id);
  if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
    throw new Error("ID_USUARIO_INVALIDO");
  }
  validarDadosUsuario({ nome, email, cargo, setor });
  validarPermissoes(perfil, tipo_usuario);
  const emailNormalizado = email.trim().toLowerCase();
  const [existentes] = await db.execute(
    "SELECT id_usuario FROM usuarios WHERE email = ? AND id_usuario <> ? LIMIT 1",
    [emailNormalizado, idNormalizado],
  );
  if (existentes.length) throw new Error("EMAIL_JA_CADASTRADO");

  const [resultado] = await db.execute(
    `UPDATE usuarios
     SET nome = ?, email = ?, cargo = ?, setor = ?, perfil = ?, tipo_usuario = ?
     WHERE id_usuario = ?`,
    [
      nome.trim(),
      emailNormalizado,
      cargo.trim(),
      setor.trim(),
      perfil,
      tipo_usuario,
      idNormalizado,
    ],
  );
  if (resultado.affectedRows === 0) return null;
  return buscarUsuarioPorId(idNormalizado);
}

export async function alterarStatusUsuario(id, status) {
  const idNormalizado = Number(id);
  if (!Number.isInteger(idNormalizado) || idNormalizado <= 0) {
    throw new Error("ID_USUARIO_INVALIDO");
  }
  if (!["Ativo", "Inativo"].includes(status)) {
    throw new Error("STATUS_INVALIDO");
  }
  const [resultado] = await db.execute(
    "UPDATE usuarios SET status = ? WHERE id_usuario = ?",
    [status, idNormalizado],
  );
  if (resultado.affectedRows === 0) return null;
  return buscarUsuarioPorId(idNormalizado);
}
