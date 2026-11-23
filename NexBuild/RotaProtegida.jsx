import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RotaProtegida({ apenasAdmin = false, apenasEquipe = false }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  let usuario = null;
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "null"); } catch {}
  if (!token || !usuario?.id_usuario) return <Navigate to="/" replace />;
  const admin = usuario.tipo_usuario === "Administrador" && usuario.perfil === "Administrador";
  const funcionario = usuario.tipo_usuario === "Funcionário";
  if (apenasEquipe && !admin && !funcionario) return <Navigate to="/home" replace />;
  if (apenasAdmin && !admin) return <Navigate to="/admin/acesso-negado" state={{ origem: location.pathname }} replace />;
  return <Outlet />;
}
