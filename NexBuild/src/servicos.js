import { API_URL } from './api';
export async function apiServico(path, options = {}) {
  let resposta;
  try {
    resposta = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}`, ...options.headers }
    });
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro;
    throw new Error(erro.name === 'TimeoutError'
      ? 'O servidor demorou para responder. Tente atualizar novamente.'
      : 'Não foi possível conectar ao servidor. Verifique se node servidor/server.js está rodando e confira VITE_API_URL.');
  }
  const texto = await resposta.text();
  let dados;
  try { dados = texto ? JSON.parse(texto) : null; } catch {
    throw new Error(`O servidor respondeu fora do formato esperado (HTTP ${resposta.status}). Confira VITE_API_URL e reinicie o servidor atualizado.`);
  }
  if (!resposta.ok) {
    const mensagem = resposta.status === 401 ? 'Sua sessão expirou. Entre novamente.'
      : resposta.status === 404 ? `Rota ${path} não encontrada. Reinicie o servidor com a versão atualizada.`
      : `Erro HTTP ${resposta.status}`;
    throw new Error(dados?.erro || mensagem);
  }
  if (dados === null) throw new Error('O servidor retornou uma resposta vazia. Tente novamente.');
  return dados;
}
export const listarFuncionarios = () => apiServico('/funcionarios');
export const atribuirFuncionario = (id, id_funcionario) => apiServico(`/ocorrencias/${id}/atribuicao`, { method:'POST', body:JSON.stringify({id_funcionario}) });
