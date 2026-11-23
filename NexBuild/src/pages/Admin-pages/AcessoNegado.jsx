import { useNavigate } from "react-router-dom";
import { FaShieldAlt, FaArrowLeft } from "react-icons/fa";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import "./AdminPaginas.css";
import "./AcessoNegado.css";

export default function AcessoNegado() {
  const navigate = useNavigate();
  return (
    <div className="admin">
      <Sidebar />
      <main className="admin-content">
        <Header />
        <section className="acesso-negado-area" aria-labelledby="acesso-negado-titulo">
          <div className="acesso-negado-card">
            <div className="acesso-negado-icone"><FaShieldAlt aria-hidden="true" /></div>
            <h1 id="acesso-negado-titulo">Acesso restrito</h1>
            <p>Esta área é exclusiva para administradores do NexBuild.</p>
            <button type="button" onClick={() => navigate("/admin")}>
              <FaArrowLeft aria-hidden="true" /> Voltar ao Dashboard
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
