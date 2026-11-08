import { useState } from "react";
import {
  searchCards,
  fetchCardDetail,
  fetchManyDetails,
  type CardBrief,
  type ApiCard,
  type Lang,
} from "../../lib/tcgcards";
import { fmtEUR } from "../../lib/format";
import CardAddForm from "./CardAddForm";

type Props = { onClose: () => void };

const PAGE = 36;

export default function CardSearch({ onClose }: Props) {
  const [lang, setLang] = useState<Lang>("fr");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CardBrief[]>([]);
  const [details, setDetails] = useState<Record<string, ApiCard>>({});
  const [shown, setShown] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [picked, setPicked] = useState<ApiCard | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function loadDetailsFor(briefs: CardBrief[]) {
    const ids = briefs
      .map((b) => b.apiId)
      .filter((id) => !details[id]);
    if (ids.length === 0) return;
    setLoadingPrices(true);
    const map = await fetchManyDetails(ids, lang);
    setDetails((prev) => ({ ...prev, ...map }));
    setLoadingPrices(false);
  }

  async function run() {
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    setDetails({});
    setShown(PAGE);
    try {
      const res = await searchCards(term, lang);
      setResults(res.cards);
      setSearched(true);
      loadDetailsFor(res.cards.slice(0, PAGE));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  }

  function showMore() {
    const next = shown + PAGE;
    setShown(next);
    loadDetailsFor(results.slice(shown, next));
  }

  async function pick(brief: CardBrief) {
    const known = details[brief.apiId];
    if (known) {
      setPicked(known);
      return;
    }
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

  const visible = results.slice(0, shown);

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
          placeholder={lang === "fr" ? "Ex : Dracaufeu, Pikachu…" : "Ex : charizard…"}
        />
        <button type="submit" className="btn primary" disabled={loading}>
          {loading ? "…" : "Chercher"}
        </button>
      </form>
      <p className="search-hint">
        {lang === "fr"
          ? "Pense aux accents (ex. « Léviator ») : la recherche FR y est sensible. "
          : ""}
        Prix Cardmarket en euros, à jour quotidiennement (TCGdex). Carte absente ? →
        saisie manuelle.
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
          Aucun résultat. Essaie un autre nom (avec accents), l'autre langue, ou la
          saisie manuelle.
        </p>
      )}

      {results.length > 0 && (
        <>
          <div className="result-grid">
            {visible.map((c) => {
              const d = details[c.apiId];
              return (
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
                    {d && (
                      <div className="st">
                        {d.setName}
                        {d.number ? " · " + d.number : ""}
                      </div>
                    )}
                    <div className="pr">
                      {d
                        ? d.marketPrice != null
                          ? fmtEUR(d.marketPrice)
                          : "—"
                        : loadingPrices
                          ? "…"
                          : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {shown < results.length && (
            <button
              className="btn"
              style={{ width: "100%", marginTop: 14 }}
              onClick={showMore}
            >
              Voir plus ({visible.length}/{results.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}
