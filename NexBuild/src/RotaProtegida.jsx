import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RotaProtegida({
  apenasAdmin = false,
  apenasEquipe = false,
}) {
  const location = useLocation();

  const token = localStorage.getItem("token");

  let usuario = null;

  try {
    usuario = JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    usuario = null;
  }

  if (!token || !usuario?.id_usuario) {
    return (
      <Navigate
        to="/login"
        state={{ retorno: location.pathname }}
        replace
      />
    );
  }

  const tipo = String(usuario.tipo_usuario || "").trim().toLowerCase();
  const perfil = String(usuario.perfil || "").trim().toLowerCase();
  const cargo = String(usuario.cargo || "").trim().toLowerCase();

  const admin =
    tipo === "administrador" ||
    perfil === "administrador" ||
    cargo === "administrador";

  const funcionario =
    tipo === "funcionário" ||
    tipo === "funcionario" ||
    cargo === "funcionário" ||
    cargo === "funcionario";

  if (apenasAdmin && !admin) {
    return (
      <Navigate
        to="/admin/acesso-negado"
        state={{ origem: location.pathname }}
        replace
      />
    );
  }

  if (apenasEquipe && !admin && !funcionario) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}