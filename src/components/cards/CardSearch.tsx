import { useState } from "react";
import { searchCards, type ApiCard } from "../../lib/pokeapi";
import { useSetting, SETTINGS_KEYS } from "../../lib/settings";
import { fmtEUR } from "../../lib/format";
import CardAddForm from "./CardAddForm";

type Props = { onClose: () => void };

export default function CardSearch({ onClose }: Props) {
  const apiKey = useSetting<string>(SETTINGS_KEYS.pokeApiKey);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ApiCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<ApiCard | null>(null);

  async function run(nextPage = 1) {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(term, nextPage, apiKey);
      setTotal(res.total);
      setPage(nextPage);
      setResults((prev) => (nextPage === 1 ? res.cards : [...prev, ...res.cards]));
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  }

  if (picked) {
    return (
      <CardAddForm
        apiCard={picked}
        onDone={() => {
          setPicked(null);
          onClose();
        }}
      />
    );
  }

  return (
    <div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          run(1);
        }}
      >
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Nom de la carte (en anglais)…"
        />
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "…" : "Chercher"}
        </button>
      </form>
      <p className="search-hint">
        L'API est anglophone : cherchez « charizard », « pikachu ex »… Pour une carte
        FR ou JP, utilisez la saisie manuelle.
      </p>

      {error && (
        <div className="search-error">
          {error}
          <button className="btn" onClick={() => run(page)} style={{ marginTop: 10 }}>
            Réessayer
          </button>
        </div>
      )}

      {searched && !error && results.length === 0 && !loading && (
        <p className="empty-state" style={{ padding: "28px 0" }}>
          Aucun résultat. Essayez un autre nom, ou la saisie manuelle.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="result-grid">
            {results.map((c) => (
              <button
                key={c.apiId}
                className="result-item"
                onClick={() => setPicked(c)}
              >
                <div className="thumb">
                  {c.image ? (
                    <img src={c.image} alt={c.name} loading="lazy" />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="meta">
                  <div className="nm">{c.name}</div>
                  <div className="st">
                    {c.setName}
                    {c.number ? " · " + c.number : ""}
                  </div>
                  <div className="pr">
                    {c.marketPrice != null ? fmtEUR(c.marketPrice) : "—"}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {results.length < total && (
            <button
              className="btn"
              style={{ width: "100%", marginTop: 14 }}
              onClick={() => run(page + 1)}
              disabled={loading}
            >
              {loading ? "Chargement…" : `Voir plus (${results.length}/${total})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
