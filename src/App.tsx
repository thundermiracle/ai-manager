import { FormEvent, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [operatorName, setOperatorName] = useState("operator");
  const [backendStatus, setBackendStatus] = useState("Not checked");
  const [checking, setChecking] = useState(false);

  async function verifyBackend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);

    try {
      const message = await invoke<string>("greet", { name: operatorName.trim() || "operator" });
      setBackendStatus(message);
    } catch {
      setBackendStatus("Failed to call backend command.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <p className="tag">Tauri 2 + React/TypeScript</p>
        <h1>AI Manager Bootstrap</h1>
        <p className="summary">
          Foundation phase is ready. Frontend and Rust backend command wiring is active.
        </p>
      </section>

      <section className="panel">
        <h2>Backend Ping</h2>
        <form className="ping-form" onSubmit={verifyBackend}>
          <label htmlFor="operator-name">Operator Name</label>
          <div className="row">
            <input
              id="operator-name"
              value={operatorName}
              onChange={(event) => setOperatorName(event.currentTarget.value)}
              placeholder="operator"
            />
            <button type="submit" disabled={checking}>
              {checking ? "Checking..." : "Call Rust Command"}
            </button>
          </div>
        </form>
        <p className="status">
          <span>Status:</span> {backendStatus}
        </p>
      </section>
    </main>
  );
}

export default App;
