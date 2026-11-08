import { useState } from "react";
import {
  searchCards,
  fetchCardDetail,
  type CardBrief,
  type ApiCard,
  type Lang,
} from "../../lib/tcgcards";
import CardAddForm from "./CardAddForm";

type Props = { onClose: () => void };

export default function CardSearch({ onClose }: Props) {
  const [lang, setLang] = useState<Lang>("fr");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CardBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<ApiCard | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function run() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(term, lang);
      setTotal(res.total);
      setResults(res.cards);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  }

  async function pick(brief: CardBrief) {
    setLoadingDetail(true);
    setError(null);
    try {
      const detail = await fetchCardDetail(brief.apiId, lang);
      setPicked(
        detail ?? {
          apiId: brief.apiId,
          apiLang: lang,
          name: brief.name,
          image: brief.image,
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoadingDetail(false);
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
      <div className="lang-toggle">
        <button
          className={lang === "fr" ? "active" : ""}
          onClick={() => setLang("fr")}
        >
          Français
        </button>
        <button
          className={lang === "en" ? "active" : ""}
          onClick={() => setLang("en")}
        >
          English
        </button>
      </div>

      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={lang === "fr" ? "Ex : dracaufeu, pikachu…" : "Ex : charizard…"}
        />
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "…" : "Chercher"}
        </button>
      </form>
      <p className="search-hint">
        Prix Cardmarket en euros, mis à jour quotidiennement (TCGdex). Cherche en
        français ou en anglais. Pour une carte absente (JP…), utilise la saisie
        manuelle.
      </p>

      {loadingDetail && (
        <p className="empty-state" style={{ padding: "16px 0" }}>
          Chargement de la carte…
        </p>
      )}

      {error && (
        <div className="search-error">
          {error}
          <button className="btn" onClick={run} style={{ marginTop: 10 }}>
            Réessayer
          </button>
        </div>
      )}

      {searched && !error && results.length === 0 && !loading && (
        <p className="empty-state" style={{ padding: "28px 0" }}>
          Aucun résultat. Essaie un autre nom, l'autre langue, ou la saisie manuelle.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="result-grid">
            {results.map((c) => (
              <button
                key={c.apiId}
                className="result-item"
                onClick={() => pick(c)}
                disabled={loadingDetail}
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
                </div>
              </button>
            ))}
          </div>
          {total > results.length && (
            <p className="search-hint" style={{ marginTop: 12 }}>
              {results.length} premiers résultats sur {total}. Affine ta recherche si
              besoin.
            </p>
          )}
        </>
      )}
    </div>
  );
}
