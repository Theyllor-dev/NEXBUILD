import NotificacoesFlutuantes from "./components/NotificacoesFlutuantes";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Admin from "./pages/Admin";
import MinhasTarefas from "./pages/Admin-pages/MinhasTarefas";
import Denuncia from "./pages/Denuncia";
import Chat from "./pages/Admin-pages/Chat";
import AltaGravidade from "./pages/Admin-pages/AltaGravidade";
import Analise from "./pages/Admin-pages/Analise";
import Mapa from "./pages/Admin-pages/Mapa";
import Agenda from "./pages/Admin-pages/Agenda";
import DenunciasTs from "./pages/Admin-pages/DenunciasTs";
import NotaInteligente from "./pages/Admin-pages/NotaInteligente";
import Usuarios from "./pages/Admin-pages/Usuarios";
import Configuracoes from "./pages/Admin-pages/Configuracoes";
import Categorias from "./pages/Admin-pages/Categorias";
import LogeCad from "./pages/Log e Cad";
const Home = lazy(() => import("./pages/Home"));
import RotaProtegida from "./RotaProtegida";
import AcessoNegado from "./pages/Admin-pages/AcessoNegado";

export default function App() {
  return <BrowserRouter><NotificacoesFlutuantes/><Routes>
    <Route path="/" element={<Suspense fallback={<div role="status">Carregando NexBuild...</div>}><Home /></Suspense>} />
    <Route path="/home" element={<Navigate to="/" replace />} />
    <Route path="/login" element={<LogeCad />} />
    <Route path="/denuncia" element={<Denuncia />} />
    <Route element={<RotaProtegida />}>
    </Route>
    <Route element={<RotaProtegida apenasEquipe />}>
      <Route path="/admin" element={<Admin />} />
      <Route path="/admin/minhas-tarefas" element={<MinhasTarefas />} />
      <Route path="/admin/denuncias" element={<DenunciasTs />} />
      <Route path="/admin/analise" element={<Analise />} />
      <Route path="/admin/alta-gravidade" element={<AltaGravidade />} />
      <Route path="/admin/mapa" element={<Mapa />} />
      <Route path="/admin/relatorios" element={<Agenda />} />
      <Route path="/admin/agenda" element={<Agenda />} />
      <Route path="/admin/nota-inteligente" element={<NotaInteligente />} />
      <Route path="/admin/chat" element={<Chat />} />
      <Route path="/admin/categorias" element={<Categorias />} />
      <Route path="/admin/acesso-negado" element={<AcessoNegado />} />
      <Route element={<RotaProtegida apenasAdmin />}>
        <Route path="/admin/usuarios" element={<Usuarios />} />
        <Route path="/admin/configuracoes" element={<Configuracoes />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></BrowserRouter>;
}
